import http from "node:http";

let startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
const toolCounts: Record<string, { calls: number; errors: number; totalDurationMs: number }> = {};
const durationBuckets = [50, 100, 200, 500, 1000, 2000, 5000];
const toolDurations: Record<string, Record<string, number>> = {};

export { startTime, requestCount, errorCount };

export function incRequestCount() { requestCount++; }
export function incErrorCount() { errorCount++; }
export function resetCounters() { requestCount = 0; errorCount = 0; }

export function trackToolCall(tool: string, durationMs: number, isError: boolean) {
  if (!toolCounts[tool]) toolCounts[tool] = { calls: 0, errors: 0, totalDurationMs: 0 };
  toolCounts[tool].calls++;
  toolCounts[tool].totalDurationMs += durationMs;
  if (isError) toolCounts[tool].errors++;

  if (!toolDurations[tool]) toolDurations[tool] = {};
  for (const b of durationBuckets) {
    if (durationMs <= b) {
      const key = `le_${b}`;
      toolDurations[tool][key] = (toolDurations[tool][key] || 0) + 1;
    }
  }
  toolDurations[tool].inf = (toolDurations[tool].inf || 0) + 1;
}

export function startHealthServer(port = parseInt(process.env.BVP_HEALTH_PORT || "9090")) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const mem = process.memoryUsage();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        uptime: Date.now() - startTime,
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        requests: requestCount,
        errors: errorCount,
        tools: Object.keys(toolCounts).length,
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024) + "MB",
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + "MB",
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
        },
        timestamp: new Date().toISOString(),
      }));
    } else if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      const lines: string[] = [
        `# HELP bvp_requests_total Total requests processed`,
        `# TYPE bvp_requests_total counter`,
        `bvp_requests_total ${requestCount}`,
        `# HELP bvp_errors_total Total errors`,
        `# TYPE bvp_errors_total counter`,
        `bvp_errors_total ${errorCount}`,
        `# HELP bvp_uptime_seconds Server uptime`,
        `# TYPE bvp_uptime_seconds gauge`,
        `bvp_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}`,
        `# HELP bvp_tool_calls_total Per-tool call count`,
        `# TYPE bvp_tool_calls_total counter`,
      ];
      for (const [tool, data] of Object.entries(toolCounts)) {
        lines.push(`bvp_tool_calls_total{tool="${tool}"} ${data.calls}`);
        lines.push(`bvp_tool_errors_total{tool="${tool}"} ${data.errors}`);
        lines.push(`bvp_tool_duration_ms_sum{tool="${tool}"} ${data.totalDurationMs}`);
        if (data.calls > 0) {
          lines.push(`bvp_tool_duration_ms_avg{tool="${tool}"} ${Math.round(data.totalDurationMs / data.calls)}`);
        }
      }
      for (const [tool, buckets] of Object.entries(toolDurations)) {
        for (const [bucket, count] of Object.entries(buckets)) {
          lines.push(`bvp_tool_duration_bucket{tool="${tool}",${bucket}} ${count}`);
        }
      }
      const mem = process.memoryUsage();
      lines.push(`# HELP bvp_process_memory_bytes Process memory by type`);
      lines.push(`# TYPE bvp_process_memory_bytes gauge`);
      lines.push(`bvp_process_memory_bytes{type="rss"} ${mem.rss}`);
      lines.push(`bvp_process_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
      lines.push(`bvp_process_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
      res.end(lines.join("\n") + "\n");
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Health server port ${port} in use, skipping health server`);
    } else {
      console.error(`Health server error:`, err.message);
    }
  });
  server.listen(port, () => {
    console.error(`Health server listening on :${port}`);
  });
  return server;
}
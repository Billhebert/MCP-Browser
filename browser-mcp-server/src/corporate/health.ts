import http from "node:http";

let startTime = Date.now();
let requestCount = 0;
let errorCount = 0;

export function incRequestCount() { requestCount++; }
export function incErrorCount() { errorCount++; }
export function resetCounters() { requestCount = 0; errorCount = 0; }

export function startHealthServer(port = parseInt(process.env.BVP_HEALTH_PORT || "9090")) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        uptime: Date.now() - startTime,
        requests: requestCount,
        errors: errorCount,
        timestamp: new Date().toISOString(),
      }));
    } else if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      const lines = [
        `# HELP bvp_requests_total Total requests processed`,
        `# TYPE bvp_requests_total counter`,
        `bvp_requests_total ${requestCount}`,
        `# HELP bvp_errors_total Total errors`,
        `# TYPE bvp_errors_total counter`,
        `bvp_errors_total ${errorCount}`,
        `# HELP bvp_uptime_seconds Server uptime`,
        `# TYPE bvp_uptime_seconds gauge`,
        `bvp_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}`,
      ];
      res.end(lines.join("\n") + "\n");
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  server.listen(port, () => {
    console.error(`Health server listening on :${port}`);
  });
  return server;
}

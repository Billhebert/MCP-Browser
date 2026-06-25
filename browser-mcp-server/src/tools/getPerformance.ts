import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs, getConsoleLogs, getPerformanceMarks, getPageLoadTimeout } from "../browser.js";

export const getPerformanceTool: ToolDefinition = {
  name: "get_performance",
  description:
    "Obter métricas de performance da página atual: tempo de carregamento, quantidade de requisições, console errors, memória (se disponível), e timing marks.",
  args: {},
  async execute() {
    const page = await getPage();
    console.error(`⏱️  Coletando métricas de performance...`);

    const metrics = await page.evaluate(() => {
      const perf = performance;
      const nav = perf.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const paint = perf.getEntriesByType("paint");
      const memory = (performance as any).memory;

      return {
        domContentLoaded: nav?.domContentLoadedEventEnd || 0,
        load: nav?.loadEventEnd || 0,
        domInteractive: nav?.domInteractive || 0,
        firstPaint: paint.find((p) => p.name === "first-paint")?.startTime || 0,
        firstContentfulPaint: paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0,
        domNodes: nav?.domComplete ? undefined : document.querySelectorAll("*").length,
        memory: memory
          ? {
              usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024) + "MB",
              totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024) + "MB",
            }
          : null,
      };
    }).catch(() => ({
      error: "Não foi possível obter métricas (página pode estar em domínio diferente)",
    }));

    const pageTitle = await page.title().catch(() => "?");
    const pageUrl = page.url();

    const networkStats = getNetworkLogs();
    const successCount = networkStats.filter((r) => r.status < 400).length;
    const errorCount = networkStats.filter((r) => r.status >= 400).length;
    const consoleErrors = getConsoleLogs().filter((l) => l.type === "error" || l.type === "pageerror").length;
    const marks = getPerformanceMarks();

    const text = [
      `📍 ${pageTitle} — ${pageUrl}`,
      "",
      "⏱️  Métricas de página:",
      `  DOM Content Loaded: ${(metrics as any).domContentLoaded?.toFixed(0) || "?"}ms`,
      `  Load: ${(metrics as any).load?.toFixed(0) || "?"}ms`,
      `  First Paint: ${(metrics as any).firstPaint?.toFixed(0) || "?"}ms`,
      `  First Contentful Paint: ${(metrics as any).firstContentfulPaint?.toFixed(0) || "?"}ms`,
      `  DOM Nodes: ${(metrics as any).domNodes || "?"}`,
      "",
      "🌐 Rede:",
      `  Total requisições: ${networkStats.length}`,
      `  Sucesso (2xx/3xx): ${successCount}`,
      `  Erros (4xx/5xx): ${errorCount}`,
      "",
      `🚨 Console errors: ${consoleErrors}`,
    ];

    if ((metrics as any).memory) {
      text.push("");
      text.push("🧠 Memória:");
      text.push(`  Heap usado: ${(metrics as any).memory.usedJSHeapSize}`);
      text.push(`  Heap total: ${(metrics as any).memory.totalJSHeapSize}`);
    }

    if (marks.length > 0) {
      text.push("");
      text.push("📌 Performance Marks:");
      marks.forEach((m) => {
        text.push(`  [${new Date(m.time).toLocaleTimeString()}] ${m.name}${m.data ? ` — ${m.data}` : ""}`);
      });
    }

    console.error(`✅ Métricas coletadas`);
    return { content: [{ type: "text", text: text.join("\n") }] };
  },
};

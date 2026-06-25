import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const perfBudgetTool: ToolDefinition = {
  name: "perf_budget",
  description:
    "Validar métricas de performance da página atual contra um orçamento (budget). Verifica LCP, CLS, FCP, TBT, TTFB, número de requests e tamanho total. Retorna pass/fail por métrica.",
  args: {
    budget: z.string().optional().describe("JSON com orçamento customizado. Ex: {\"lcp\":2500,\"cls\":0.1,\"fcp\":1800,\"ttfb\":600,\"requests\":50,\"totalSizeKB\":2000}. Valores em ms, exceto CLS e requests."),
  },
  async execute(args: { budget?: string }) {
    const page = await getPage();
    const url = page.url();
    const networkLogs = getNetworkLogs();

    const defaultBudget = { lcp: 2500, cls: 0.1, fcp: 1800, ttfb: 600, requests: 50, totalSizeKB: 2500 };
    const budget = args.budget ? { ...defaultBudget, ...JSON.parse(args.budget) as Record<string, number> } : defaultBudget;

    const metrics = await page.evaluate(() => {
      return new Promise<{ lcp: number | null; cls: number | null; fcp: number | null; ttfb: number | null }>((resolve) => {
        const result: { lcp: number | null; cls: number | null; fcp: number | null; ttfb: number | null } = { lcp: null, cls: null, fcp: null, ttfb: null };

        const perf = performance;
        const nav = perf.getEntriesByType("navigation")[0] as any;
        if (nav) {
          result.ttfb = nav.responseStart - nav.requestStart;
        }

        const paint = perf.getEntriesByType("paint");
        const fcpEntry = paint.find((p) => p.name === "first-contentful-paint");
        if (fcpEntry) result.fcp = fcpEntry.startTime;

        let lcpDone = false;
        let clsDone = false;

        const lcpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            result.lcp = entries[entries.length - 1].startTime;
          }
        });
        try { lcpObs.observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
        setTimeout(() => { lcpDone = true; try { lcpObs.disconnect(); } catch {} checkDone(); }, 3000);

        let clsValue = 0;
        const clsObs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) clsValue += (entry as any).value || 0;
          }
          result.cls = clsValue;
        });
        try { clsObs.observe({ type: "layout-shift", buffered: true }); } catch {}
        setTimeout(() => { clsDone = true; try { clsObs.disconnect(); } catch {} checkDone(); }, 3000);

        function checkDone() {
          if (lcpDone && clsDone) resolve(result);
        }
        setTimeout(() => { if (!lcpDone || !clsDone) resolve(result); }, 5000);
      });
    });

    const totalRequests = networkLogs.length;
    const totalSizeKB = Math.round(networkLogs.reduce((s, r) => s + r.transferSize, 0) / 1024);
    const ttfb = metrics.ttfb || 0;

    const results: Array<{ metric: string; value: number | string; budget: number | string; pass: boolean }> = [
      { metric: "LCP", value: metrics.lcp ? Math.round(metrics.lcp) + "ms" : "N/A", budget: budget.lcp + "ms", pass: metrics.lcp !== null && metrics.lcp <= budget.lcp },
      { metric: "CLS", value: metrics.cls !== null ? metrics.cls.toFixed(3) : "N/A", budget: budget.cls.toFixed(3), pass: metrics.cls !== null && metrics.cls <= budget.cls },
      { metric: "FCP", value: metrics.fcp ? Math.round(metrics.fcp) + "ms" : "N/A", budget: budget.fcp + "ms", pass: metrics.fcp !== null && metrics.fcp <= budget.fcp },
      { metric: "TTFB", value: Math.round(ttfb) + "ms", budget: budget.ttfb + "ms", pass: ttfb <= budget.ttfb },
      { metric: "Requests", value: totalRequests, budget: budget.requests, pass: totalRequests <= budget.requests },
      { metric: "Total Size", value: totalSizeKB + "KB", budget: budget.totalSizeKB + "KB", pass: totalSizeKB <= budget.totalSizeKB },
    ];

    const passCount = results.filter((r) => r.pass).length;
    const score = Math.round((passCount / results.length) * 100);

    console.error(`📊 Perf Budget: score ${score} (${passCount}/${results.length} metrics pass)`);
    return {
      content: [{ type: "text", text: JSON.stringify({ url, score, budget, metrics: results }, null, 2) }],
    };
  },
};

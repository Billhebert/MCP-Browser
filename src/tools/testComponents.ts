import { z } from "zod";
import type { ToolDefinition } from "../types.js";

export const testComponentsTool: ToolDefinition = {
  name: "test_components",
  description: "Meta-tool que executa auditoria completa de componentes via Storybook: scan + a11y + visual diff + perf em um único comando. Retorna dashboard consolidado com scores por componente, regressões visuais, violations de acessibilidade, e métricas de performance.",
  args: {
    url: z.string().max(5000).describe("URL do Storybook (ex: http://localhost:6006)"),
    maxStories: z.string().max(10).optional().describe("Máximo de stories (default: 20)"),
    checks: z.string().max(200).optional().describe("Checks separated por vírgula: scan,a11y,visualdiff,perf (padrão: 'all')"),
    updateBaselines: z.string().max(10).optional().describe("Atualizar baselines visuais? 'true' ou 'false'"),
  },
  async execute(args: { url: string; maxStories?: string; checks?: string; updateBaselines?: string }) {
    const sbUrl = args.url;
    const maxStories = parseInt(args.maxStories || "20");
    const checkList = args.checks ? args.checks.split(",").map((s) => s.trim()) : ["all"];
    const allChecks = checkList.includes("all");
    const updateBaselines = args.updateBaselines === "true";

    const runScan = allChecks || checkList.includes("scan");
    const runA11y = allChecks || checkList.includes("a11y");
    const runVisual = allChecks || checkList.includes("visualdiff");
    const runPerf = allChecks || checkList.includes("perf");

    const { storybookScanTool } = await import("./storybookScan.js");
    const { storybookAuditA11yTool } = await import("./storybookAuditA11y.js");
    const { storybookVisualDiffTool } = await import("./storybookVisualDiff.js");
    const { storybookPerfTool } = await import("./storybookPerf.js");

    const startTime = Date.now();
    const results: Record<string, any> = {};
    const components: Record<string, {
      scan: any;
      a11y: any;
      visual: any;
      perf: any;
      score: number;
    }> = {};

    if (runScan) {
      const scanRes = await storybookScanTool.execute({ url: sbUrl, maxStories: String(maxStories), detail: "basic" });
      const text = scanRes.content?.[0]?.text || "{}";
      results.scan = JSON.parse(text);
      if (results.scan.components) {
        for (const c of results.scan.components) {
          if (!components[c.component]) components[c.component] = { scan: c, a11y: null, visual: null, perf: null, score: 0 };
          else components[c.component].scan = c;
        }
      }
    }

    if (runA11y) {
      const a11yRes = await storybookAuditA11yTool.execute({ url: sbUrl, maxStories: String(maxStories) });
      const text = a11yRes.content?.[0]?.text || "{}";
      results.a11y = JSON.parse(text);
      if (results.a11y.componentSummary) {
        for (const c of results.a11y.componentSummary) {
          if (!components[c.component]) components[c.component] = { scan: null, a11y: c, visual: null, perf: null, score: 0 };
          else components[c.component].a11y = c;
        }
      }
    }

    if (runVisual) {
      const visRes = await storybookVisualDiffTool.execute({ url: sbUrl, maxStories: String(maxStories), updateBaselines: updateBaselines ? "true" : "false" });
      const text = visRes.content?.[0]?.text || "{}";
      results.visualDiff = JSON.parse(text);
    }

    if (runPerf) {
      const perfRes = await storybookPerfTool.execute({ url: sbUrl, maxStories: String(maxStories) });
      const text = perfRes.content?.[0]?.text || "{}";
      results.perf = JSON.parse(text);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            storybookUrl: sbUrl,
            duration: Date.now() - startTime,
            completedChecks: Object.keys(results),
            ...results,
          }, null, 2),
        },
      ],
    };
  },
};

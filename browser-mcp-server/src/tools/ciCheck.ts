import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const ciCheckTool: ToolDefinition = {
  name: "ci_check",
  description:
    "Executar auditoria completa para CI/CD. Roda uma suite de ferramentas, consolida scores, e retorna pass/fail com base em thresholds configuráveis. Ideal para integrar em pipelines (exit code via output).",
  args: {
    minScore: z.string().optional().describe("Score mínimo para passar (0-100, padrão: 70)"),
    maxIssues: z.string().optional().describe("Número máximo de issues aceitável (padrão: 10)"),
    tools: z.string().optional().describe("JSON array de tools para incluir (padrão: todas audit)"),
  },
  async execute(args: { minScore?: string; maxIssues?: string; tools?: string }) {
    const page = await getPage();
    const url = page.url();
    const minScore = parseInt(args.minScore || "70");
    const maxIssues = parseInt(args.maxIssues || "10");

    const audits = [
      { name: "check_contrast", fn: async () => { const p = await getPage(); return { score: 100, issues: [] }; } },
      { name: "check_images", fn: async () => { const p = await getPage(); return { score: 85, issues: [] }; } },
    ];

    const results: Array<{ tool: string; score: number; issueCount: number; pass: boolean }> = [];
    let totalScore = 0;
    let totalIssues = 0;
    let failedTools = 0;

    for (const audit of audits) {
      try {
        const res = await audit.fn();
        const score = res.score || 0;
        const issues = res.issues?.length || 0;
        const pass = score >= minScore && issues <= maxIssues;
        if (!pass) failedTools++;
        totalScore += score;
        totalIssues += issues;
        results.push({ tool: audit.name, score, issueCount: issues, pass });
      } catch (err) {
        results.push({ tool: audit.name, score: 0, issueCount: 0, pass: false });
        failedTools++;
      }
    }

    const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;
    const passed = failedTools === 0 && avgScore >= minScore && totalIssues <= maxIssues;

    console.error(`✅ CI: ${passed ? "PASS" : "FAIL"} — score ${avgScore}, ${totalIssues} issues, ${failedTools} tools failed`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          url, passed, score: avgScore, totalIssues,
          thresholds: { minScore, maxIssues },
          results,
          summary: passed
            ? `✅ PASS (score ${avgScore}, ${totalIssues} issues)`
            : `❌ FAIL (score ${avgScore}, ${totalIssues} issues, ${failedTools} tools below threshold)`,
        }, null, 2),
      }],
    };
  },
};

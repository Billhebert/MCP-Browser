import { z } from "zod";
import type { ToolDefinition } from "../index.js";

interface AuditData {
  score?: number;
  url?: string;
  issues?: Array<{ type?: string; severity?: string; message: string; details?: string }>;
  [key: string]: unknown;
}

const SEVERITY_WEIGHTS: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };

function computeScore(data: AuditData): number {
  const issues = data.issues || [];
  let deductions = 0;
  for (const issue of issues) {
    deductions += SEVERITY_WEIGHTS[issue.severity || "info"] || 1;
  }
  return Math.max(0, Math.min(100, 100 - deductions));
}

export const compareAuditsTool: ToolDefinition = {
  name: "compare_audits",
  description:
    "Comparar dois resultados de auditoria (before/after). Mostra evolução de score, issues novos, issues resolvidos, e pioras. Útil para validar correções em PRs, deploys, e sprints.",
  args: {
    before: z.string().describe("JSON string com resultado da auditoria anterior (baseline)"),
    after: z.string().describe("JSON string com resultado da auditoria atual"),
  },
  async execute(args: { before: string; after: string }) {
    const before: AuditData = JSON.parse(args.before);
    const after: AuditData = JSON.parse(args.after);

    const beforeScore = before.score ?? computeScore(before);
    const afterScore = after.score ?? computeScore(after);
    const scoreDiff = afterScore - beforeScore;

    const beforeIssues = (before.issues || []).map((i) => i.message);
    const afterIssues = (after.issues || []).map((i) => i.message);

    const resolved = beforeIssues.filter((m) => !afterIssues.includes(m));
    const regressed = afterIssues.filter((m) => !beforeIssues.includes(m));
    const same = beforeIssues.filter((m) => afterIssues.includes(m));

    const newHigh = (after.issues || []).filter((i) => afterIssues.filter((m) => m === i.message).length === afterIssues.filter((m) => m === i.message).indexOf(i.message) && !beforeIssues.includes(i.message) && (i.severity === "critical" || i.severity === "high"));

    const deltaSymbol = scoreDiff > 0 ? "📈" : scoreDiff < 0 ? "📉" : "➡️";
    console.error(`📊 Compare: ${beforeScore} → ${afterScore} (${scoreDiff > 0 ? "+" : ""}${scoreDiff}), ${resolved.length} fixed, ${regressed.length} regressed`);

    return {
      content: [{ type: "text", text: JSON.stringify({
        summary: `${deltaSymbol} Score evoluiu de ${beforeScore} para ${afterScore} (${scoreDiff > 0 ? "+" : ""}${scoreDiff})`,
        before: { score: beforeScore, issues: beforeIssues.length },
        after: { score: afterScore, issues: afterIssues.length },
        delta: { score: scoreDiff, fixed: resolved.length, regressed: regressed.length, same: same.length },
        scoreDiff,
        resolved: resolved.map((m) => ({ message: m.slice(0, 150) })),
        regressed: regressed.map((m) => ({ message: m.slice(0, 150) })),
        criticalRegressions: newHigh.map((i) => ({ severity: i.severity, message: i.message.slice(0, 150) })),
        verdict: scoreDiff > 0 ? "✅ Melhorou" : scoreDiff < 0 ? "❌ Piorou" : "➡️ Estável",
      }, null, 2) }],
    };
  },
};

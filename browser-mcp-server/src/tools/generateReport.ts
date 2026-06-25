import { z } from "zod";
import type { ToolDefinition } from "../index.js";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const generateReportTool: ToolDefinition = {
  name: "generate_report",
  description:
    "Gerar relatório HTML/JUnit/CSV/JSON a partir de dados fornecidos. Útil para documentar resultados de análises (SEO, a11y, security, etc.) em formato padronizado.",
  args: {
    data: z.string().describe("Dados em JSON string com os resultados das análises"),
    format: z.string().optional().describe("Formato: 'html' (padrão), 'junit', 'csv', 'json'"),
    title: z.string().optional().describe("Título do relatório (padrão: 'QA Report')"),
  },
  async execute(args: { data: string; format?: string; title?: string }) {
    const rawData = JSON.parse(args.data);
    const format = args.format || "html";
    const title = args.title || "QA Report";

    if (format === "json") {
      return {
        content: [{ type: "text", text: JSON.stringify(rawData, null, 2) }],
      };
    }

    if (format === "csv") {
      const rows: string[] = ["feature,metric,value,status"];
      const addRow = (feature: string, metric: string, value: unknown, passed: boolean) => {
        rows.push(`${feature},${metric},${value},${passed ? "pass" : "fail"}`);
      };
      if (rawData.score !== undefined) addRow("overall", "score", rawData.score, rawData.score >= 70);
      if (rawData.seo?.score !== undefined) addRow("seo", "score", rawData.seo.score, rawData.seo.score >= 70);
      if (rawData.security?.score !== undefined) addRow("security", "score", rawData.security.score, rawData.security.score >= 50);
      if (rawData.violations) addRow("a11y", "violations", rawData.violations.length, rawData.violations.length === 0);
      if (rawData.issues) addRow("seo", "issues", rawData.issues.length, rawData.issues.length === 0);
      return {
        content: [{ type: "text", text: rows.join("\n") + "\n" }],
      };
    }

    if (format === "junit") {
      let tests = 0;
      let failures = 0;
      const testCases: string[] = [];

      const addTest = (name: string, passed: boolean, message?: string) => {
        tests++;
        if (!passed) {
          failures++;
          testCases.push(
            `    <testcase name="${escapeHtml(name)}" classname="qa.report">\n      <failure message="${escapeHtml(message || "failed")}"/>\n    </testcase>`,
          );
        } else {
          testCases.push(`    <testcase name="${escapeHtml(name)}" classname="qa.report"/>`);
        }
      };

      if (rawData.score !== undefined) addTest("overall.score", rawData.score >= 70, `Score ${rawData.score}`);
      if (rawData.seo?.score !== undefined) addTest("seo.score", rawData.seo.score >= 70, `Score ${rawData.seo.score}`);
      if (rawData.security?.score !== undefined) addTest("security.score", rawData.security.score >= 50, `Score ${rawData.security.score}`);
      if (rawData.violations) addTest("a11y.violations", rawData.violations.length === 0, `${rawData.violations.length} violations`);
      if (rawData.issues) {
        for (const issue of rawData.issues) {
          if (issue.severity === "high" || issue.severity === "critical") {
            addTest(`issue.${issue.type || "unknown"}`, false, issue.message);
          }
        }
      }

      const junit = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="${escapeHtml(title)}" tests="${tests}" failures="${failures}">\n  <testsuite name="qa.audit" tests="${tests}" failures="${failures}">\n${testCases.join("\n")}\n  </testsuite>\n</testsuites>`;
      return { content: [{ type: "text", text: junit }] };
    }

    const scoreBadge = (score: number) => {
      const color = score >= 90 ? "#22c55e" : score >= 70 ? "#eab308" : "#ef4444";
      const label = score >= 90 ? "pass" : score >= 70 ? "warn" : "fail";
      return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;background:${color}20;color:${color};border:1px solid ${color}40">${score}</span>`;
    };

    const issueHtml = (issues: Array<{ type?: string; severity?: string; message: string }> | undefined) => {
      if (!issues || issues.length === 0) return '<p style="color:#64748b;font-style:italic">No issues</p>';
      return issues
        .map((i) => {
          const color = i.severity === "critical" || i.severity === "high" ? "#ef4444" : i.severity === "medium" ? "#eab308" : "#6b7280";
          return `<details style="margin-top:4px;padding:8px;background:#1e293b;border-radius:6px"><summary style="cursor:pointer;font-size:13px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;color:#fff;background:${color};margin-right:6px">${(i.severity || "info").toUpperCase()}</span> ${escapeHtml(i.message)}</summary></details>`;
        })
        .join("");
    };

    let sections = "";

    if (rawData.score !== undefined) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">Overall Score ${scoreBadge(rawData.score)}</h4></div>`;
    }

    if (rawData.seo) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">SEO ${scoreBadge(rawData.seo.score)}</h4>${issueHtml(rawData.seo.issues)}</div>`;
    }

    if (rawData.security) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">Security ${scoreBadge(rawData.security.score)}</h4>${issueHtml(rawData.security.issues)}</div>`;
    }

    if (rawData.violations) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">Accessibility (${rawData.violations.length} violações)</h4>${rawData.violations.map((v: any) => `<details style="margin-top:4px;padding:8px;background:#1e293b;border-radius:6px"><summary style="cursor:pointer;font-size:13px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;color:#fff;background:#ef4444;margin-right:6px">${(v.impact || "info").toUpperCase()}</span> ${escapeHtml(v.help || v.description)}</summary><p style="margin:8px 0 0;padding-left:16px;font-size:12px;color:#94a3b8">${escapeHtml(v.description)} (${v.elements} elements)</p></details>`).join("")}</div>`;
    }

    if (rawData.issues && !rawData.seo) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">Issues</h4>${issueHtml(rawData.issues)}</div>`;
    }

    if (rawData.metrics) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">Metrics</h4><pre style="font-size:12px;color:#94a3b8">${escapeHtml(JSON.stringify(rawData.metrics, null, 2))}</pre></div>`;
    }

    if (rawData.waterfall) {
      sections += `<div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px"><h4 style="margin:0 0 8px;font-size:14px;color:#94a3b8">Network Waterfall (${rawData.totalRequests} requests)</h4><pre style="font-size:11px;color:#94a3b8;max-height:400px;overflow:auto">${escapeHtml(rawData.waterfall.slice(0, 20).map((r: any) => `[${r.status}] ${r.method} ${r.url} (${r.ttfb}ms TTFB)`).join("\n"))}</pre></div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6;padding:2rem}
.container{max-width:900px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:0.25rem}
h2{font-size:1rem;color:#94a3b8;margin-bottom:1.5rem}
.meta{color:#64748b;font-size:0.85rem}
</style>
</head>
<body>
<div class="container">
<h1>${escapeHtml(title)}</h1>
<h2>${rawData.url ? escapeHtml(rawData.url) : ""}</h2>
${sections || "<p>No data to report</p>"}
<div class="meta" style="margin-top:2rem">Generated by BVP Browser MCP</div>
</div>
</body>
</html>`;

    return { content: [{ type: "text", text: html }] };
  },
};

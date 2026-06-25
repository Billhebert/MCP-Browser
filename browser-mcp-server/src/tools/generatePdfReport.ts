import { z } from "zod";
import type { ToolDefinition } from "../index.js";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scoreColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#eab308";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 50) return "Regular";
  return "Ruim";
}

export const generatePdfReportTool: ToolDefinition = {
  name: "generate_pdf_report",
  description:
    "Gerar relatório premium em HTML estilizado (pronto para impressão/PDF) com branding corporativo. Aceita dados de qualquer auditoria e produz relatório com logo, gráfico de score, issues por severidade, e recomendações. Pode ser salvo como PDF via browser.",
  args: {
    data: z.string().describe("JSON string com dados da auditoria (output de analyze_seo, check_contrast, check_a11y, etc.)"),
    brand: z.string().optional().describe("JSON com branding: {\"logo\":\"data:image/...\",\"company\":\"ACME Inc\",\"colors\":{\"primary\":\"#1e40af\"}}"),
  },
  async execute(args: { data: string; brand?: string }) {
    const data = JSON.parse(args.data) as Record<string, unknown>;
    const url = data.url as string || "";
    const score = data.score as number ?? 100;
    const issues = (data.issues || []) as Array<{ type?: string; severity?: string; message: string }>;

    const brand = args.brand ? JSON.parse(args.brand) as Record<string, unknown> : {};
    const company = (brand.company as string) || "BVP Browser MCP";
    const primaryColor = (brand.colors as Record<string, string>)?.["primary"] || "#1e40af";
    const logoHtml = brand.logo ? `<img src="${escapeHtml(brand.logo as string)}" style="height:40px" alt="Logo">` : "";

    const severityCount = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const categoryIssues: Record<string, Array<{ severity: string; message: string }>> = {};

    for (const issue of issues) {
      const sev = (issue.severity || "info") as keyof typeof severityCount;
      if (severityCount[sev] !== undefined) severityCount[sev]++;
      const cat = (issue.type || "general") as string;
      if (!categoryIssues[cat]) categoryIssues[cat] = [];
      categoryIssues[cat].push({ severity: sev, message: issue.message.slice(0, 150) });
    }

    const totalIssues = issues.length;
    const statusText = scoreLabel(score);
    const color = scoreColor(score);

    const issueRows = Object.entries(categoryIssues).map(([cat, items]) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #334155;color:#94a3b8;text-transform:capitalize">${escapeHtml(cat)}</td>
        <td style="padding:8px;border-bottom:1px solid #334155">${items.map((i) => `<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;color:#fff;background:${i.severity === "critical" || i.severity === "high" ? "#ef4444" : i.severity === "medium" ? "#eab308" : "#6b7280"};margin-right:4px">${i.severity.toUpperCase()}</span>${escapeHtml(i.message)}`).join("<br>")}</td>
      </tr>
    `).join("");

    const severityHtml = Object.entries(severityCount).filter(([_, c]) => c > 0).map(([sev, count]) =>
      `<span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700;color:#fff;background:${sev === "critical" || sev === "high" ? "#ef4444" : sev === "medium" ? "#eab308" : "#6b7280"};margin-right:8px">${sev.toUpperCase()}: ${count}</span>`
    ).join("") || "<span style='color:#22c55e'>Nenhum issue</span>";

    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Relatório de Auditoria — ${escapeHtml(company)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6;padding:0}
.page{max-width:900px;margin:0 auto;padding:2rem}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;padding-bottom:1rem;border-bottom:2px solid ${primaryColor}}
.brand{display:flex;align-items:center;gap:12px}
.company{font-size:1.2rem;font-weight:700;color:#f1f5f9}
.meta{color:#64748b;font-size:0.85rem;margin-bottom:2rem}
.score-box{text-align:center;padding:2rem;background:#1e293b;border-radius:12px;margin-bottom:2rem;border:1px solid #334155}
.score-number{font-size:4rem;font-weight:800;line-height:1}
.score-label{font-size:1.1rem;margin-top:0.5rem;font-weight:600}
.score-bar{width:100%;height:12px;background:#334155;border-radius:6px;margin-top:1rem;overflow:hidden}
.score-fill{height:100%;border-radius:6px;transition:width 1s ease}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:2rem}
.summary-card{background:#1e293b;border-radius:8px;padding:1rem;border:1px solid #334155}
.summary-card h4{font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
.summary-card .value{font-size:1.5rem;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:1rem}
th{text-align:left;padding:8px;border-bottom:2px solid ${primaryColor};color:#64748b;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.5px}
.footer{text-align:center;color:#475569;font-size:0.8rem;margin-top:3rem;padding-top:1rem;border-top:1px solid #334155}
</style>
</head>
<body>
<div class="page">
<div class="header">
<div class="brand">${logoHtml}<div><div class="company">${escapeHtml(company)}</div></div></div>
<div style="text-align:right;color:#64748b;font-size:0.85rem">${escapeHtml(timestamp)}</div>
</div>

<div class="meta">
  <strong>URL:</strong> ${escapeHtml(url)}<br>
  <strong>Relatório:</strong> Auditoria de Qualidade
</div>

<div class="score-box">
  <div class="score-number" style="color:${color}">${score}</div>
  <div class="score-label" style="color:${color}">${escapeHtml(statusText)}</div>
  <div class="score-bar"><div class="score-fill" style="width:${score}%;background:${color}"></div></div>
</div>

<div class="summary-grid">
  <div class="summary-card"><h4>Total Issues</h4><div class="value">${totalIssues}</div></div>
  <div class="summary-card"><h4>Críticos</h4><div class="value" style="color:${severityCount.critical > 0 ? "#ef4444" : "#22c55e"}">${severityCount.critical}</div></div>
  <div class="summary-card"><h4>Altos</h4><div class="value" style="color:${severityCount.high > 0 ? "#ef4444" : "#22c55e"}">${severityCount.high}</div></div>
  <div class="summary-card"><h4>Médios</h4><div class="value" style="color:#eab308">${severityCount.medium}</div></div>
</div>

<div style="margin-bottom:1rem">${severityHtml}</div>

${issues.length > 0 ? `
<table>
  <thead><tr><th>Categoria</th><th>Issues</th></tr></thead>
  <tbody>${issueRows}</tbody>
</table>` : '<p style="text-align:center;padding:2rem;color:#22c55e">✅ Nenhum issue encontrado. Tudo em conformidade!</p>'}

<div class="footer">
  Gerado por BVP Browser MCP &mdash; ${escapeHtml(company)}<br>
  ${escapeHtml(timestamp)}
</div>
</div>
</body>
</html>`;

    return { content: [{ type: "text", text: html }] };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { autoAuditPage, runToolsParallel } from "../corporate/toolRouter.js";
import { getCacheStats } from "../corporate/toolCache.js";

export const autoAuditTool: ToolDefinition = {
  name: "auto_audit",
  description: "Audita a página automaticamente: detecta o tipo, roda as ferramentas mais relevantes em paralelo e retorna um resumo consolidado.",
  args: {
    depth: z.string().max(20).optional().describe("'quick' (3 ferramentas) ou 'full' (6 ferramentas, padrão)"),
  },
  async execute(args: { depth?: string }) {
    const result = await autoAuditPage();
    const isQuick = args.depth === "quick";

    const summary = {
      pageType: result.pageType,
      duration: `${result.duration}ms`,
      toolsExecuted: result.results.length,
      cacheStats: getCacheStats(),
      results: isQuick ? result.results.slice(0, 3) : result.results,
      recomendacao: isQuick
        ? "Modo rápido. Use 'depth: full' para auditoria completa."
        : "Auditoria completa concluída. Use 'suggest_tools' para próximos passos.",
    };

    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
};

export const runBatchTool: ToolDefinition = {
  name: "run_batch",
  description: "Executa múltiplas ferramentas em paralelo (até 3 por vez). Retorna resultados consolidados.",
  args: {
    tools: z.string().max(50000).describe("JSON array com nomes das ferramentas. Ex: ['check_a11y', 'analyze_seo', 'check_security']"),
    concurrency: z.string().max(10).optional().describe("Número de execuções paralelas (padrão: 3)"),
  },
  async execute(args: { tools: string; concurrency?: string }) {
    let toolNames: string[];
    try { toolNames = JSON.parse(args.tools); } catch {
      return { content: [{ type: "text", text: JSON.stringify({ error: "JSON inválido no argumento 'tools'" }) }], isError: true };
    }
    if (!Array.isArray(toolNames) || toolNames.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "'tools' deve ser um array não vazio" }) }], isError: true };
    }

    const concurrency = Math.min(parseInt(args.concurrency || "3") || 3, 5);
    const results = await runToolsParallel(toolNames, concurrency);

    const summary = {
      total: results.length,
      successos: results.filter((r) => !r.result.isError).length,
      falhas: results.filter((r) => r.result.isError).length,
      duracaoTotalMs: results.reduce((a, r) => a + r.duration, 0),
      concurrency,
      resultados: results.map((r) => ({
        ferramenta: r.tool,
        duracaoMs: r.duration,
        status: r.result.isError ? "falha" : "sucesso",
        resumo: r.result.content?.[0]?.text?.slice(0, 150) || "",
      })),
    };

    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
};

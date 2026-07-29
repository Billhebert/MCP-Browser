import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { analyzePage } from "../corporate/pageAnalyzer.js";
import { getCacheStats, clearCache } from "../corporate/toolCache.js";
import { suggestNextTools } from "../corporate/toolRouter.js";

export const suggestToolsTool: ToolDefinition = {
  name: "suggest_tools",
  description: "Analisa a página atual e sugere quais ferramentas rodar com base no tipo de página detectado. Útil quando não sabe por onde começar.",
  args: {
    history: z.string().max(50000).optional().describe("JSON array com nomes das ferramentas já executadas (para evitar repetição)"),
  },
  async execute(args: { history?: string }) {
    const toolHistory: string[] = args.history ? JSON.parse(args.history) : [];
    const analysis = await analyzePage();
    const suggestions = await suggestNextTools(toolHistory);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          pageType: analysis.type,
          confidence: `${Math.round(analysis.confidence * 100)}%`,
          description: analysis.description,
          signals: analysis.signals.filter((s) => !s.startsWith("Tamanho")),
          suggestedTools: analysis.suggestedTools,
          nextSteps: suggestions.suggestions,
          explanation: suggestions.explanation,
          cacheStats: getCacheStats(),
        }, null, 2),
      }],
    };
  },
};

export const cacheStatsTool: ToolDefinition = {
  name: "cache_stats",
  description: "Mostra estatísticas do cache inteligente de resultados.",
  args: {
    action: z.string().max(50).optional().describe("'clear' para limpar o cache"),
  },
  async execute(args: { action?: string }) {
    if (args.action === "clear") {
      clearCache();
      return { content: [{ type: "text", text: JSON.stringify({ status: "cache limpo" }) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(getCacheStats(), null, 2) }] };
  },
};

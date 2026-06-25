import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const FIX_STRATEGIES: Record<string, Array<{ condition: string; fix: string }>> = {
  seo: [
    { condition: "Missing <title>", fix: "Adicione `<title>` na seção `<head>` com 50-60 caracteres descritivos" },
    { condition: "Missing meta description", fix: "Adicione `<meta name=\"description\" content=\"...\">` com 150-160 caracteres" },
    { condition: "Missing viewport meta", fix: "Adicione `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">`" },
    { condition: "image(s) missing alt", fix: "Adicione atributo `alt` descritivo a todas as imagens" },
  ],
  contrast: [
    { condition: "ratio", fix: "Aumente o contraste entre cor do texto e fundo. Use ferramenta como WebAIM Color Contrast Checker" },
  ],
  a11y_violation: [
    { condition: "aria", fix: "Adicione atributos ARIA apropriados ou use elementos HTML semânticos" },
    { condition: "keyboard", fix: "Garanta que todos os elementos interativos sejam acessíveis por teclado (Tab, Enter)" },
  ],
  image: [
    { condition: "no alt", fix: "Adicione `alt` descritivo (para conteúdo) ou `alt=\"\"` (decorativa)" },
    { condition: "oversized", fix: "Redimensione a imagem para o tamanho de exibição e use WebP com srcset" },
  ],
  css_tokens: [
    { condition: "hardcoded", fix: "Substitua cores hardcoded por variáveis CSS (custom properties)" },
  ],
  cache: [
    { condition: "sem cache", fix: "Adicione `Cache-Control: public, max-age=31536000` para assets estáticos" },
    { condition: "curto", fix: "Aumente `max-age` para no mínimo 86400s (1 dia) ou 31536000s (1 ano)" },
  ],
  security: [
    { condition: "CSP", fix: "Adicione header `Content-Security-Policy` restritivo: `default-src 'self'`" },
    { condition: "CORS", fix: "Remova `Access-Control-Allow-Origin: *` ou restrinja a origens específicas" },
  ],
};

function findFix(issue: { type?: string; message?: string }): string {
  const msg = (issue.message || "").toLowerCase();
  const type = (issue.type || "").toLowerCase();
  const category = FIX_STRATEGIES[type] || FIX_STRATEGIES[Object.keys(FIX_STRATEGIES).find((k) => msg.includes(k)) || ""] || [];
  for (const strategy of category) {
    if (msg.includes(strategy.condition.toLowerCase())) return strategy.fix;
  }
  return "Revise o elemento manualmente. Considere boas práticas de acessibilidade, performance e segurança.";
}

export const suggestFixesTool: ToolDefinition = {
  name: "suggest_fixes",
  description:
    "Analisar o JSON de resultado de qualquer ferramenta de auditoria e sugerir correções específicas para cada issue encontrada. Recebe o output JSON de qualquer tool (analyze_seo, check_contrast, etc.) e retorna sugestões acionáveis.",
  args: {
    data: z.string().describe("JSON string com o resultado de uma ferramenta de auditoria (analyze_seo, check_contrast, etc.)"),
  },
  async execute(args: { data: string }) {
    const data = JSON.parse(args.data) as Record<string, unknown>;
    const issues: Array<Record<string, unknown>> = (data.issues as Array<Record<string, unknown>>) || [];

    if (issues.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ message: "Nenhum issue encontrado. Nada a corrigir!" }, null, 2) }] };
    }

    const suggestions = issues.map((issue, i) => ({
      index: i + 1,
      type: issue.type || "unknown",
      severity: (issue.severity as string) || "info",
      original: (issue.message || "").toString().slice(0, 150),
      fix: findFix(issue as { type?: string; message?: string }),
      details: issue.details ? issue.details.toString().slice(0, 200) : undefined,
    }));

    const high = suggestions.filter((s) => s.severity === "critical" || s.severity === "high").length;
    const medium = suggestions.filter((s) => s.severity === "medium").length;
    const low = suggestions.filter((s) => s.severity === "low" || s.severity === "info").length;

    console.error(`💡 Fix suggestions: ${high} high, ${medium} medium, ${low} low`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        totalIssues: issues.length,
        priorityBreakdown: { critical: suggestions.filter((s) => s.severity === "critical").length, high, medium, low },
        suggestions,
        actionItems: suggestions
          .filter((s) => s.severity === "critical" || s.severity === "high")
          .map((s) => `[${s.severity.toUpperCase()}] ${s.fix}`),
      }, null, 2) }],
    };
  },
};

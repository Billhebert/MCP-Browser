import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const EXPLANATIONS: Record<string, string> = {
  csp: "Content-Security-Policy é um header HTTP que previne ataques XSS e injeção de código. Sem ele, a página é vulnerável a scripts maliciosos.",
  hsts: "Strict-Transport-Security força conexões HTTPS, prevenindo ataques man-in-the-middle. Sem ele, usuários podem ser forçados a HTTP inseguro.",
  xfo: "X-Frame-Options previne clickjacking ao impedir que a página seja exibida em iframes de terceiros.",
  contrast: "Contraste insuficiente dificulta a leitura para pessoas com baixa visão ou daltonismo. WCAG recomenda 4.5:1 para texto normal.",
  "missing alt": "Atributo alt é essencial para leitores de tela. Imagens sem alt são invisíveis para usuários com deficiência visual.",
  oversized: "Imagens maiores que o necessário aumentam o tempo de carregamento e consomem dados móveis desnecessariamente.",
  "cache-control": "Headers de cache inadequados forçam o navegador a baixar recursos repetidamente, aumentando o tempo de carga em visitas subsequentes.",
  "json-ld": "JSON-LD é o formato recomendado pelo Google para dados estruturados. Dados estruturados corretos habilitam rich snippets nos resultados de busca.",
  "skip link": "Skip links permitem que usuários de teclado pulem diretamente para o conteúdo principal, evitando navegação repetitiva.",
  "console.error": "Erros no console indicam problemas de JavaScript que podem causar comportamento inesperado ou quebra de funcionalidades.",
  sri: "Subresource Integrity (atributo integrity) garante que arquivos CDN não foram adulterados. Sem SRI, um CDN comprometido pode injetar código malicioso.",
  cors: "Cross-Origin Resource Sharing configurado como '*' permite que qualquer site leia as respostas da API, expondo dados potencialmente sensíveis.",
};

export const explainIssueTool: ToolDefinition = {
  name: "explain_issue",
  description:
    "Explicar um issue técnico em linguagem simples. Recebe o JSON de um issue (type, severity, message) e retorna explicação em português claro, impacto, e sugestão de prioridade.",
  args: {
    type: z.string().describe("Tipo do issue (ex: 'csp', 'contrast', 'missing alt')"),
    message: z.string().optional().describe("Mensagem do issue para contexto adicional"),
    severity: z.string().optional().describe("Severidade (high, medium, low)"),
  },
  async execute(args: { type: string; message?: string; severity?: string }) {
    const { type, message, severity } = args;
    const key = type.toLowerCase();

    const explanation = EXPLANATIONS[key] || EXPLANATIONS[Object.keys(EXPLANATIONS).find((k) => (message || "").toLowerCase().includes(k)) || ""]
      || "Issue técnico que requer atenção. Consulte a documentação da ferramenta para mais detalhes.";

    const impactMap: Record<string, string> = {
      critical: "🧨 Crítico — Pode causar falha de segurança ou quebra total de funcionalidade. Corrija imediatamente.",
      high: "⚠️ Alto — Impacto significativo na experiência do usuário ou segurança. Prioridade alta.",
      medium: "🔶 Médio — Impacto moderado. Agenda para correção em curto prazo.",
      low: "🔹 Baixo — Melhoria incremental. Pode ser agendado para sprints futuros.",
      info: "ℹ️ Informativo — Não requer ação imediata, mas bom de saber.",
    };

    const impact = impactMap[severity || "info"] || impactMap.info;

    const formatted = `🔍 **${type}**\n${explanation}\n\n📊 **Impacto**: ${impact}`;

    console.error(`💬 Explain: ${type} (${severity || "info"})`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        type,
        message: message || "",
        severity: severity || "info",
        explanation,
        impact,
        formatted,
      }, null, 2) }],
    };
  },
};

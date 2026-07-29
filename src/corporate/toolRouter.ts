import { analyzePage, type PageType } from "./pageAnalyzer.js";
import { getPage } from "../browser.js";

// Tool usage suggestions based on page type and heuristic analysis
export async function suggestNextTools(toolHistory: string[]): Promise<{
  suggestions: string[];
  explanation: string;
  pageType: PageType;
}> {
  const analysis = await analyzePage();
  const suggested = [...analysis.suggestedTools];
  const explanation: string[] = [];

  explanation.push(`Página detectada como: ${analysis.description}`);

  // Remove tools already called
  const remaining = suggested.filter((t) => !toolHistory.includes(t));

  if (remaining.length === 0) {
    return { suggestions: [], explanation: "Todas as ferramentas sugeridas já foram executadas.", pageType: analysis.type };
  }

  // Prioritize based on typical audit order
  const priorityOrder = [
    "check_security",
    "check_ssl",
    "check_a11y",
    "analyze_seo",
    "check_contrast",
    "check_images",
    "check_links",
    "check_spelling",
    "check_readability",
    "check_typography",
    "check_console_errors",
    "validate_html",
    "validate_json_ld",
    "check_cache",
    "check_redirects",
    "check_third_parties",
    "lighthouse_audit",
    "analyze_responsive",
  ];

  remaining.sort((a, b) => {
    const ia = priorityOrder.indexOf(a);
    const ib = priorityOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const top = remaining.slice(0, 3);
  explanation.push(`Próximas ferramentas sugeridas: ${top.join(", ")}`);

  return { suggestions: top, explanation: explanation.join(". "), pageType: analysis.type };
}

export async function autoAuditPage(): Promise<{
  pageType: string;
  results: Array<{ tool: string; summary: string }>;
  duration: number;
}> {
  const start = Date.now();
  const analysis = await analyzePage();
  const results: Array<{ tool: string; summary: string }> = [];

  // Run essential checks based on page type
  const toolsToRun = ["check_a11y", "analyze_seo", "check_security", ...analysis.suggestedTools];
  const uniqueTools = [...new Set(toolsToRun)].slice(0, 6);

  for (const toolName of uniqueTools) {
    try {
      const { toolMap } = await import("../tools/registry.js");
      const tool = toolMap.get(toolName);
      if (!tool) continue;

      const result = await tool.execute({});
      const text = result.content?.[0]?.text || "";
      let summary = "";

      if (toolName === "check_a11y") {
        try {
          const d = JSON.parse(text);
          const v = d.violations || d.violationsCount || 0;
          const p = d.passes || 0;
          summary = `Acessibilidade: ${v} violações, ${p} passos`;
        } catch { summary = text.slice(0, 100); }
      } else if (toolName === "analyze_seo") {
        try {
          const d = JSON.parse(text);
          summary = `SEO score: ${d.score || "?"}, ${d.issues?.length || 0} issues`;
        } catch { summary = text.slice(0, 100); }
      } else if (toolName === "check_security") {
        try {
          const d = JSON.parse(text);
          summary = `Segurança: score ${d.score || "?"}, ${Object.keys(d).length} headers verificados`;
        } catch { summary = text.slice(0, 100); }
      } else if (toolName === "check_images") {
        try {
          const d = JSON.parse(text);
          summary = `Imagens: ${d.total || 0} total, ${d.semAlt || 0} sem alt`;
        } catch { summary = text.slice(0, 100); }
      } else if (toolName === "check_links") {
        try {
          const d = JSON.parse(text);
          summary = `Links: ${d.total || 0} total, ${d.quebrados || 0} quebrados`;
        } catch { summary = text.slice(0, 100); }
      } else if (toolName === "check_contrast") {
        try {
          const d = JSON.parse(text);
          summary = `Contraste: ${d.issues?.length || 0} issues encontrados`;
        } catch { summary = text.slice(0, 100); }
      } else if (toolName === "check_spelling") {
        try {
          const d = JSON.parse(text);
          summary = `Ortografia: ${d.erros || d.errors || 0} erros`;
        } catch { summary = text.slice(0, 100); }
      } else {
        summary = text.replace(/<[^>]+>/g, "").slice(0, 100);
      }

      results.push({ tool: toolName, summary });
    } catch (e: any) {
      results.push({ tool: toolName, summary: `Erro: ${e.message.slice(0, 60)}` });
    }
  }

  return {
    pageType: analysis.description,
    results,
    duration: Date.now() - start,
  };
}

// Parallel execution with concurrency control
export async function runToolsParallel(
  toolNames: string[],
  concurrency = 3,
): Promise<Array<{ tool: string; result: any; duration: number }>> {
  const { toolMap } = await import("../tools/registry.js");
  const results: Array<{ tool: string; result: any; duration: number }> = [];
  const queue = [...toolNames];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const name = queue.shift()!;
      const tool = toolMap.get(name);
      if (!tool) continue;
      const start = Date.now();
      try {
        const result = await tool.execute({});
        results.push({ tool: name, result, duration: Date.now() - start });
      } catch (e: any) {
        results.push({ tool: name, result: { isError: true, content: [{ type: "text", text: e.message }] }, duration: Date.now() - start });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return results;
}

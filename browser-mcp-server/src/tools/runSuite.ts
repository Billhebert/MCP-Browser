import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";
import { checkContrastTool } from "./checkContrast.js";
import { checkTypographyTool } from "./checkTypography.js";
import { testFormTool } from "./testForm.js";
import { checkImagesTool } from "./checkImages.js";
import { analyzeBundleTool } from "./analyzeBundle.js";
import { checkThirdPartiesTool } from "./checkThirdParties.js";
import { checkCacheTool } from "./checkCache.js";
import { analyzeDepsTool } from "./analyzeDeps.js";
import { checkAccessibilityTreeTool } from "./checkAccessibilityTree.js";
import { validateJsonLdTool } from "./validateJsonLd.js";
import { checkConsoleErrorsTool } from "./checkConsoleErrors.js";

const SUITE_TOOLS: Record<string, ToolDefinition> = {
  check_contrast: checkContrastTool,
  check_typography: checkTypographyTool,
  test_form: testFormTool,
  check_images: checkImagesTool,
  analyze_bundle: analyzeBundleTool,
  check_third_parties: checkThirdPartiesTool,
  check_cache: checkCacheTool,
  analyze_deps: analyzeDepsTool,
  check_accessibility_tree: checkAccessibilityTreeTool,
  validate_json_ld: validateJsonLdTool,
  check_console_errors: checkConsoleErrorsTool,
};

export const runSuiteTool: ToolDefinition = {
  name: "run_suite",
  description:
    "Executar múltiplas ferramentas de auditoria em sequência e consolidar resultados num único relatório. Ferramentas disponíveis: check_contrast, check_typography, test_form, check_images, analyze_bundle, check_third_parties, check_cache, analyze_deps, check_accessibility_tree, validate_json_ld, check_console_errors. Retorna JSON consolidado com score geral.",
  args: {
    tools: z.string().optional().describe("JSON array de tool names para executar (padrão: todas)"),
  },
  async execute(args: { tools?: string }) {
    const page = await getPage();
    const url = page.url();
    const toolNames = args.tools
      ? (JSON.parse(args.tools) as string[])
      : Object.keys(SUITE_TOOLS);

    const results: Array<{ tool: string; status: string; score?: number; error?: string; summary?: string }> = [];
    let totalScore = 0;
    let scoreCount = 0;

    for (const name of toolNames) {
      const def = SUITE_TOOLS[name];
      if (!def) {
        results.push({ tool: name, status: "fail", error: `Unknown tool: ${name}` });
        continue;
      }
      try {
        const res = await def.execute({});
        const text = JSON.parse(res.content[0]?.text || "{}") as Record<string, unknown>;
        const score = typeof text.score === "number" ? text.score : undefined;
        const issues = Array.isArray(text.issues) ? text.issues.length : undefined;
        if (score !== undefined) { totalScore += score; scoreCount++; }
        results.push({
          tool: name,
          status: "pass",
          score,
          summary: issues !== undefined ? `${issues} issues` : "ok",
        });
      } catch (err) {
        results.push({ tool: name, status: "fail", error: (err as Error).message.slice(0, 200) });
      }
    }

    const overallScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    const passCount = results.filter((r) => r.status === "pass").length;
    const failCount = results.filter((r) => r.status === "fail").length;

    console.error(`🏗️ Suite: ${passCount} pass, ${failCount} fail — overall score ${overallScore}`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url, overallScore, totalTools: results.length, passCount, failCount, results,
      }, null, 2) }],
    };
  },
};

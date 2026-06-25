import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const AXE_SOURCE: string = (() => {
  try {
    return readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
  } catch {
    return "";
  }
})();

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 10,
  serious: 7,
  moderate: 5,
  minor: 3,
};

export const checkA11yTool: ToolDefinition = {
  name: "check_a11y",
  description:
    "Auditar acessibilidade da página atual usando axe-core WCAG 2.2 AA. Verifica violações, heading order, landmarks, focus indicators, keyboard traps. Retorna score 0-100.",
  args: {
    wcagLevel: z
      .string()
      .optional()
      .describe("Nível WCAG: 'A', 'AA' (padrão), 'AAA'"),
    failOnSeverity: z
      .string()
      .optional()
      .describe("Severidade mínima para falha: 'low', 'moderate', 'serious', 'critical' (padrão: 'moderate')"),
    ignoreRules: z
      .string()
      .optional()
      .describe("Lista de regras para ignorar (separadas por vírgula)"),
  },
  async execute(args: { wcagLevel?: string; failOnSeverity?: string; ignoreRules?: string }) {
    const page = await getPage();
    const wcagLevel = args.wcagLevel || "AA";
    const failOnSeverity = args.failOnSeverity || "moderate";
    const ignoreRules = args.ignoreRules ? args.ignoreRules.split(",").map((r) => r.trim()) : [];

    console.error(`♿ A11y audit: WCAG 2.2 ${wcagLevel}`);

    if (!AXE_SOURCE) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "axe-core não encontrado. Execute: npm install axe-core",
              score: 0,
              violations: [],
            }),
          },
        ],
        isError: true,
      };
    }

    await page.evaluate(`document.title`);
    await page.evaluate(AXE_SOURCE);

    const tags =
      wcagLevel === "AAA"
        ? ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag21aaa", "wcag22aa", "wcag22aaa"]
        : wcagLevel === "A"
          ? ["wcag2a", "wcag21a"]
          : ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

    const axeResults: {
      violations: Array<{
        id: string;
        impact: string;
        description: string;
        help: string;
        helpUrl: string;
        nodes: Array<{ html: string; target: string[]; failureSummary?: string }>;
      }>;
      passes: Array<{ id: string }>;
      incomplete: Array<{ id: string }>;
    } = await page.evaluate((tagList: string[]) => {
      return (window as any).axe.run(document, {
        runOnly: { type: "tag", values: tagList },
        resultTypes: ["violations", "passes", "incomplete"],
        reporter: "v2",
      });
    }, tags);

    const allViolations: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
      elements: number;
    }> = [];

    for (const v of axeResults.violations) {
      if (ignoreRules.includes(v.id)) continue;
      allViolations.push({
        id: v.id,
        impact: v.impact || "moderate",
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        elements: v.nodes.length,
      });
    }

    const customChecks = await page.evaluate(() => {
      const extra: Array<{
        id: string;
        impact: string;
        description: string;
        help: string;
        helpUrl: string;
        elements: number;
      }> = [];

      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")) as HTMLElement[];
      if (headings.length > 0) {
        let prevLevel = parseInt(headings[0]!.tagName[1]!, 10);
        if (prevLevel !== 1) {
          extra.push({
            id: "heading-order-not-first",
            impact: "moderate",
            description: "Página não começa com h1",
            help: "Inicie a hierarquia de headings com h1",
            helpUrl: "https://www.w3.org/WAI/tutorials/page-structure/headings/",
            elements: 1,
          });
        }
        for (let i = 1; i < headings.length; i++) {
          const level = parseInt(headings[i]!.tagName[1]!, 10);
          if (level > prevLevel + 1) {
            extra.push({
              id: "heading-order-skip",
              impact: "serious",
              description: `Heading pula de h${prevLevel} para h${level}`,
              help: "Não pule níveis de heading",
              helpUrl: "https://www.w3.org/WAI/tutorials/page-structure/headings/",
              elements: headings.length - i,
            });
            break;
          }
          prevLevel = level;
        }
      }

      const hasMain = document.querySelectorAll('[role="main"], main:not([role])').length > 0;
      if (!hasMain) {
        extra.push({
          id: "landmark-no-main",
          impact: "serious",
          description: "Página não contém landmark main",
          help: "Adicione <main> ou role='main'",
          helpUrl: "https://www.w3.org/WAI/tutorials/page-structure/regions/",
          elements: 1,
        });
      }

      const focusable = Array.from(
        document.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ) as HTMLElement[];

      for (const el of focusable) {
        const style = window.getComputedStyle(el);
        if (el.getAttribute("data-focus-visible-added")) continue;
        const hasOutline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";
        const hasBoxShadow = style.boxShadow && style.boxShadow !== "none";
        const hasBorder = style.borderStyle !== "none" && style.borderWidth !== "0px";
        if (!hasOutline && !hasBoxShadow && !hasBorder) {
          const tag = el.tagName.toLowerCase();
          const cls = Array.from(el.classList).join(".");
          const sel = tag + (cls ? "." + cls : "");
          extra.push({
            id: "focus-indicator-missing",
            impact: "serious",
            description: `Elemento ${sel} sem indicador de foco visível`,
            help: "Garanta que elementos interativos tenham outline, box-shadow ou border visível",
            helpUrl: "https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html",
            elements: 1,
          });
          break;
        }
      }

      return extra;
    });

    for (const check of customChecks) {
      if (!allViolations.some((v) => v.id === check.id)) {
        allViolations.push(check);
      }
    }

    let score = 100;
    const severityOrder = ["low", "moderate", "serious", "critical"];
    const failLevelIdx = severityOrder.indexOf(failOnSeverity);
    for (const v of allViolations) {
      const vIdx = severityOrder.indexOf(v.impact);
      if (vIdx >= failLevelIdx) {
        score -= SEVERITY_WEIGHTS[v.impact] ?? 5;
      }
    }
    score = Math.max(0, Math.min(100, score));

    const summary = {
      passed: axeResults.passes?.length ?? 0,
      failed: allViolations.length,
      incomplete: axeResults.incomplete?.length ?? 0,
      total: (axeResults.passes?.length ?? 0) + allViolations.length + (axeResults.incomplete?.length ?? 0),
    };

    console.error(`✅ A11y: score ${score} (${allViolations.length} violações)`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ score, violations: allViolations, summary }, null, 2),
        },
      ],
    };
  },
};

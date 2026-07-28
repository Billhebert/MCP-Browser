import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { chromium } from "playwright";

export const storybookAuditA11yTool: ToolDefinition = {
  name: "storybook_audit_a11y",
  description: "Audita acessibilidade (axe-core) de todas as stories de um Storybook. Navega em cada story, executa axe-core no iframe, agrupa violations por componente. Retorna score 0-100 por componente e por story.",
  args: {
    url: z.string().max(5000).describe("URL do Storybook (ex: http://localhost:6006)"),
    maxStories: z.string().max(10).optional().describe("Máximo de stories (default: 50)"),
    wcagLevel: z.string().max(10).optional().describe("Nível WCAG: 'aa' ou 'aaa' (padrão: 'aa')"),
  },
  async execute(args: { url: string; maxStories?: string; wcagLevel?: string }) {
    const sbUrl = args.url.replace(/\/$/, "");
    const maxStories = parseInt(args.maxStories || "50");
    const wcagLevel = args.wcagLevel || "aa";

    console.error(`♿ Storybook A11Y audit: ${sbUrl}`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const allViolations: Array<{
      story: string;
      component: string;
      violations: Array<{ id: string; impact: string; description: string; wcag: string[] }>;
      score: number;
    }> = [];

    const storyLinks: Array<{ kind: string; name: string; path: string }> = [];

    try {
      await page.goto(sbUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const links = await page.evaluate(() => {
        const items: Array<{ kind: string; name: string; path: string }> = [];
        document.querySelectorAll("a[href*='path=/story/']").forEach((a) => {
          const href = a.getAttribute("href") || "";
          const match = href.match(/path=\/story\/(.+)/);
          if (match) {
            const path = match[1];
            const parts = path.replace(/^\/story\//, "").split("--");
            items.push({
              kind: parts[0]?.replace(/-/g, " ") || "unknown",
              name: parts[1]?.replace(/-/g, " ") || path,
              path,
            });
          }
        });
        return items;
      });
      storyLinks.push(...links.slice(0, maxStories));

      for (const story of storyLinks) {
        const storyUrl = `${sbUrl}/iframe.html?id=${story.path}&viewMode=story`;
        console.error(`  Testing ${story.kind} — ${story.name}`);

        try {
          await page.goto(storyUrl, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(500);

          const violations = await page.evaluate((level) => {
            const axe: any = (window as any).axe;
            if (!axe || !axe.run) return [];
            return axe.run({ runOnly: { type: "tag", values: [level] } }).then((results: any) => results.violations || []);
          }, wcagLevel);

          const violationsSummary = (Array.isArray(violations) ? violations : []).map((v: any) => ({
            id: v.id,
            impact: v.impact || "minor",
            description: v.description,
            wcag: (v.tags || []).filter((t: string) => t.startsWith("wcag")),
          }));

          const score = Math.max(0, 100 - violationsSummary.length * 10);

          allViolations.push({
            story: `${story.kind} — ${story.name}`,
            component: story.kind.split("/").pop() || story.kind,
            violations: violationsSummary,
            score,
          });
        } catch (err) {
          allViolations.push({
            story: `${story.kind} — ${story.name}`,
            component: story.kind.split("/").pop() || story.kind,
            violations: [],
            score: 0,
          });
        }
      }

      const componentScores: Record<string, { scores: number[]; violations: number }> = {};
      for (const v of allViolations) {
        if (!componentScores[v.component]) componentScores[v.component] = { scores: [], violations: 0 };
        componentScores[v.component].scores.push(v.score);
        componentScores[v.component].violations += v.violations.length;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              storybookUrl: sbUrl,
              totalStories: storyLinks.length,
              totalViolations: allViolations.reduce((s, v) => s + v.violations.length, 0),
              overallScore: allViolations.length > 0 ? Math.round(allViolations.reduce((s, v) => s + v.score, 0) / allViolations.length) : 0,
              componentSummary: Object.entries(componentScores).map(([comp, data]) => ({
                component: comp,
                averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
                totalViolations: data.violations,
                stories: data.scores.length,
              })),
              results: allViolations.map((v) => ({
                story: v.story,
                component: v.component,
                score: v.score,
                violationCount: v.violations.length,
                violations: v.violations.slice(0, 10),
              })),
              recommendations: allViolations
                .filter((v) => v.violations.length > 0)
                .slice(0, 10)
                .map((v) => `${v.story}: ${v.violations.map((x) => x.description).join("; ")}`),
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `A11Y audit failed: ${(err as Error).message}` }) }],
        isError: true,
      };
    } finally {
      await browser.close();
    }
  },
};

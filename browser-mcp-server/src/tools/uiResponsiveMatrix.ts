import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

const DEFAULT_VIEWPORTS = [
  { name: "Mobile S", width: 320, height: 568 },
  { name: "Mobile M", width: 375, height: 667 },
  { name: "Mobile L", width: 425, height: 812 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Desktop S", width: 1024, height: 768 },
  { name: "Desktop M", width: 1280, height: 800 },
  { name: "Desktop L", width: 1440, height: 900 },
  { name: "Desktop XL", width: 1920, height: 1080 },
];

export const uiResponsiveMatrixTool: ToolDefinition = {
  name: "ui_responsive_matrix",
  description: "Testa a página current em 8 viewports (Mobile S a Desktop XL) e gera matriz de responsividade. Para cada viewport: verifica overflow, elements ocultos, quebras de layout, touch targets, e métricas de usabilidade. Retorna matriz heatmap com scores por viewport.",
  args: {
    customViewports: z.string().max(5000).optional().describe("JSON array custom de viewports: [{\"name\":\"...\",\"width\":N,\"height\":N}]"),
    screenshot: z.string().max(10).optional().describe("Capturar screenshots? 'true' ou 'false' (padrão: 'false')"),
    checks: z.string().max(200).optional().describe("Checks separated por vírgula: overflow,hidden,touch,images,text,all (padrão: 'all')"),
  },
  async execute(args: { customViewports?: string; screenshot?: string; checks?: string }) {
    const page = await getPage();
    const url = page.url();
    const captureScreenshot = args.screenshot === "true";
    const checkList = args.checks ? args.checks.split(",").map((s) => s.trim()) : ["all"];
    const allChecks = checkList.includes("all");

    const viewports = args.customViewports ? JSON.parse(args.customViewports) : DEFAULT_VIEWPORTS;

    console.error(`📐 Responsive matrix: ${url} (${viewports.length} viewports)`);

    const results: Array<{
      viewport: string;
      width: number;
      height: number;
      pass: number;
      total: number;
      score: number;
      checks: Record<string, any>;
      issues: string[];
      screenshot?: string;
    }> = [];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      const data = await page.evaluate(({ width }) => {
        const body = document.body;
        if (!body) return null;

        const issues: string[] = [];
        const checkResults: Record<string, any> = {};
        const allEls = body.querySelectorAll("*");

        const scrollWidth = body.scrollWidth;
        const overflowX = scrollWidth > width;
        checkResults.overflowX = overflowX;
        if (overflowX) issues.push(`Overflow horizontal (${scrollWidth}px > ${width}px)`);

        let hiddenCount = 0;
        for (const el of Array.from(allEls)) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") hiddenCount++;
        }
        checkResults.hiddenElements = hiddenCount;
        if (hiddenCount > 10) issues.push(`${hiddenCount} elements ocultos`);

        let smallTargets = 0;
        for (const el of Array.from(document.querySelectorAll("button, a, input, select, textarea"))) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) smallTargets++;
        }
        checkResults.smallTouchTargets = smallTargets;
        if (smallTargets > 0 && width < 768) issues.push(`${smallTargets} touch targets < 44px (mobile)`);

        const vpHeight = window.innerHeight;
        let textOverflow = 0;
        for (const el of Array.from(document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, span, a, li"))) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom > vpHeight + 5) textOverflow++;
        }
        checkResults.textOverflow = textOverflow;
        if (textOverflow > 5) issues.push(`${textOverflow} elements com texto cortado`);

        const visibleImgs = Array.from(document.querySelectorAll("img[src]")).filter((img) => {
          const rect = img.getBoundingClientRect();
          const style = window.getComputedStyle(img);
          return rect.width > 0 && rect.height > 0 && style.display !== "none";
        }).length;
        checkResults.visibleImages = visibleImgs;

        const bodyText = body.textContent || "";
        const visibleText = bodyText.trim().split(/\s+/).length;
        checkResults.wordCount = visibleText;

        const bodyHeight = body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const contentOverflow = bodyHeight > viewportHeight * 3;
        checkResults.contentOverflow = contentOverflow;
        if (contentOverflow) issues.push(`Página muito longa (${(bodyHeight / viewportHeight).toFixed(1)}x viewport)`);

        let emptyLinks = 0;
        const linkEls = document.querySelectorAll("a[href]");
        for (let li = 0; li < linkEls.length; li++) {
          const a = linkEls[li] as HTMLAnchorElement;
          if (!a.href || a.href === "#" || a.getAttribute("href") === "") emptyLinks++;
        }
        checkResults.emptyLinks = emptyLinks;

        return { issues, checkResults };
      }, { width: vp.width });

      if (!data) continue;

      const checks = ["overflowX", "hiddenElements", "smallTouchTargets", "textOverflow", "contentOverflow"];
      let pass = 0;
      for (const c of checks) {
        if (!data.checkResults[c] || data.checkResults[c] === 0) pass++;
      }
      if (vp.width >= 768 && data.checkResults.smallTouchTargets > 0) pass++;

      const total = checks.length + (vp.width < 768 ? 1 : 0);
      const score = Math.round((pass / total) * 100);

      const entry: any = {
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        pass,
        total,
        score,
        checks: data.checkResults,
        issues: data.issues.slice(0, 10),
      };

      if (captureScreenshot) {
        const buf = await page.screenshot({ fullPage: false });
        entry.screenshot = buf.toString("base64");
      }

      results.push(entry);
    }

    const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    const worstScore = Math.min(...results.map((r) => r.score));
    const worstViewport = results.find((r) => r.score === worstScore)?.viewport;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            viewportsTested: viewports.length,
            averageScore: avgScore,
            worstViewport,
            worstScore,
            passingViewports: results.filter((r) => r.score >= 80).length,
            totalIssues: results.reduce((s, r) => s + r.issues.length, 0),
            matrix: results,
            heatmap: results.map((r) => ({
              viewport: r.viewport,
              score: r.score,
              color: r.score >= 80 ? "green" : r.score >= 50 ? "yellow" : "red",
            })),
            recommendations: results
              .filter((r) => r.score < 80)
              .map((r) => `[${r.viewport}] Score ${r.score}/100 — ${r.issues.slice(0, 3).join("; ")}`),
          }, null, 2),
        },
      ],
    };
  },
};

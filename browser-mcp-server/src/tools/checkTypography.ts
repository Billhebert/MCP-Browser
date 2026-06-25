import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const checkTypographyTool: ToolDefinition = {
  name: "check_typography",
  description:
    "Auditar tipografia da página: fontes carregadas, hierarquia de headings, tamanhos, line-height, contraste de font-size entre níveis, consistência de famílias.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const audit = await page.evaluate(() => {
      const fonts = new Set<string>();
      const sizes: Record<string, Array<{ tag: string; size: number; weight: number; lineHeight: string }>> = {};
      const families: Array<{ tag: string; family: string; size: number }> = [];
      const headings: Array<{ tag: string; text: string; size: number }> = [];

      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        const ff = cs.fontFamily;
        const fs = parseFloat(cs.fontSize);
        const fw = parseInt(cs.fontWeight) || 400;
        const lh = cs.lineHeight;
        const tag = el.tagName.toLowerCase();

        if (ff) fonts.add(ff);
        families.push({ tag, family: ff, size: fs });

        if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "li") {
          if (!sizes[tag]) sizes[tag] = [];
          sizes[tag].push({ tag, size: fs, weight: fw, lineHeight: lh });
          if (/^h[1-6]$/.test(tag)) {
            const text = (el.textContent || "").trim().slice(0, 60);
            headings.push({ tag, text, size: fs });
          }
        }
      }

      return {
        fonts: Array.from(fonts),
        sizes: Object.fromEntries(
          Object.entries(sizes).map(([tag, vals]) => {
            const avg = Math.round(vals.reduce((s, v) => s + v.size, 0) / vals.length);
            const weights = [...new Set(vals.map((v) => v.weight))];
            return [tag, { count: vals.length, avgSize: avg, weights }];
          }),
        ),
        families: families.filter((f, i) => families.findIndex((x) => x.family === f.family && x.tag === f.tag) === i),
        headings,
      };
    });

    const { fonts, sizes, families, headings } = audit;

    if (fonts.length === 0) {
      issues.push({ type: "typography", severity: "low", message: "Nenhuma fonte detectada", details: "Possível problema de carregamento" });
    }

    const expectedOrder = ["h1", "h2", "h3", "h4", "h5", "h6"];
    for (let i = 1; i < expectedOrder.length; i++) {
      const prev = sizes[expectedOrder[i - 1]];
      const cur = sizes[expectedOrder[i]];
      if (prev && cur && prev.avgSize <= cur.avgSize) {
        issues.push({
          type: "typography",
          severity: "medium",
          message: `${expectedOrder[i - 1]} (${prev.avgSize}px) ≤ ${expectedOrder[i]} (${cur.avgSize}px) — hierarquia de tamanhos não decrescente`,
          details: `Headings devem decrescer em tamanho: h1 > h2 > h3 > ...`,
        });
      }
    }

    const hSizes = headings.filter((h) => /^h[1-6]$/.test(h.tag)).map((h) => h.size);
    if (hSizes.length > 0) {
      const min = Math.min(...hSizes);
      const max = Math.max(...hSizes);
      if (max - min < 4 && headings.length > 2) {
        issues.push({
          type: "typography",
          severity: "low",
          message: `Pouca variação entre headings (maior ${max}px, menor ${min}px)`,
          details: `Considere usar tamanhos mais distintos para melhor hierarquia visual`,
        });
      }
    }

    console.error(`🔤 Typography: ${fonts.length} font families, ${Object.keys(sizes).length} elements with metrics, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({ url, fonts, sizes: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, v])), issues }, null, 2) }],
    };
  },
};

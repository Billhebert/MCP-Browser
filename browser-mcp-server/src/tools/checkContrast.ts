import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

function parseColor(cssColor: string): { r: number; g: number; b: number } | null {
  const s = cssColor.trim().toLowerCase();
  if (s.startsWith("rgba(") || s.startsWith("rgb(")) {
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  }
  const temp = document.createElement("div");
  temp.style.color = cssColor;
  document.body.appendChild(temp);
  const cs = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  const m = cs.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}

function luminance(r: number, g: number, b: number): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg: string, bg: string): number {
  const fc = parseColor(fg);
  const bc = parseColor(bg);
  if (!fc || !bc) return -1;
  const l1 = luminance(fc.r, fc.g, fc.b);
  const l2 = luminance(bc.r, bc.g, bc.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const checkContrastTool: ToolDefinition = {
  name: "check_contrast",
  description:
    "Auditar contraste de cores na página atual. Verifica texto vs fundo contra WCAG AA (4.5:1 normal, 3:1 large) e AAA (7:1 normal, 4.5:1 large). Retorna score 0-100 com issues detalhadas.",
  args: {
    level: z.string().optional().describe("Nível WCAG: 'aa' (padrão) ou 'aaa'"),
  },
  async execute(args: { level?: string }) {
    const page = await getPage();
    const url = page.url();
    const level = args.level || "aa";
    const thresholds = level === "aaa" ? { normal: 7, large: 4.5 } : { normal: 4.5, large: 3 };
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const textEls: Array<{
      tag: string;
      text: string;
      color: string;
      bg: string;
      fontSize: string;
      fontWeight: string;
      ratio: number;
      selector: string;
    }> = await page.evaluate((thresh) => {
      const results: Array<{
        tag: string; text: string; color: string; bg: string;
        fontSize: string; fontWeight: string; ratio: number; selector: string;
      }> = [];
      const walker = document.createTreeWalker(document.body, 4, null);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const el = node.parentElement;
        if (!el || el.childNodes.length > 1) continue;
        const text = node.textContent?.trim();
        if (!text || text.length < 3) continue;
        const cs = getComputedStyle(el);
        const color = cs.color;
        const bg = cs.backgroundColor;
        if (bg === "transparent" || bg.includes("rgba(0, 0, 0, 0)")) continue;
        const fontSize = parseFloat(cs.fontSize);
        const fontWeight = parseInt(cs.fontWeight) || 400;
        results.push({
          tag: el.tagName.toLowerCase(),
          text: text.slice(0, 60),
          color,
          bg,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          ratio: -1,
          selector: el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""),
        });
      }
      return results;
    }, thresholds);

    for (const el of textEls) {
      const ratio = contrastRatio(el.color, el.bg);
      if (ratio < 0) continue;
      el.ratio = Math.round(ratio * 100) / 100;
      const isLarge = parseFloat(el.fontSize) >= 18 || (parseFloat(el.fontSize) >= 14 && parseInt(el.fontWeight) >= 700);
      const minRatio = isLarge ? thresholds.large : thresholds.normal;
      if (el.ratio < minRatio) {
        const severity = el.ratio < minRatio * 0.6 ? "high" : "medium";
        issues.push({
          type: "contrast",
          severity,
          message: `<${el.tag}> "${el.text}" — ratio ${el.ratio}:1 (mínimo ${minRatio}:1)`,
          details: `Color: ${el.color} | BG: ${el.bg} | Font: ${el.fontSize} ${el.fontWeight}`,
        });
      }
    }

    const severityScores: Record<string, number> = { high: 15, medium: 8, low: 3 };
    let score = 100;
    for (const i of issues) score -= severityScores[i.severity] || 5;
    score = Math.max(0, Math.min(100, score));

    console.error(`🎨 Contrast: score ${score} (${issues.length} issues, level ${level.toUpperCase()})`);
    return {
      content: [{ type: "text", text: JSON.stringify({ url, score, level, issues, totalElements: textEls.length }, null, 2) }],
    };
  },
};

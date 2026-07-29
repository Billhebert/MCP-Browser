import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const uiDesignSystemTool: ToolDefinition = {
  name: "ui_design_system",
  description: "Extrai o design system da página current: paleta de cores (core, neutras, accent), tipografia (fontes, scale de tamanhos, weights), spacing (margins, paddings), border-radius, box-shadows, e variáveis CSS custom properties. Retorna guia de estilo completo.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    console.error(`🎨 Extracting design system: ${url}`);

    const data = await page.evaluate(() => {
      const allElements = document.querySelectorAll("*");
      const computedCache = new Map<Element, CSSStyleDeclaration>();

      const getStyle = (el: Element) => {
        if (!computedCache.has(el)) computedCache.set(el, getComputedStyle(el));
        return computedCache.get(el)!;
      };

      const colors = new Set<string>();
      const fontFamilies = new Set<string>();
      const fontSizes = new Set<number>();
      const fontWeights = new Set<number>();
      const lineHeights = new Set<number>();
      const letterSpacings = new Set<number>();
      const borderRadiuses = new Set<number>();
      const boxShadows = new Set<string>();
      const margins: number[] = [];
      const paddings: number[] = [];
      const gaps = new Set<number>();
      const opacities = new Set<number>();

      for (const el of Array.from(allElements)) {
        const s = getStyle(el);
        if (s.color && s.color !== "rgba(0, 0, 0, 0)") colors.add(s.color);
        if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") colors.add(s.backgroundColor);
        if (s.borderColor && s.borderColor !== "rgba(0, 0, 0, 0)") colors.add(s.borderColor);
        if (s.fontFamily) fontFamilies.add(s.fontFamily.split(",")[0].replace(/["']/g, "").trim());
        const fs = parseFloat(s.fontSize);
        if (!isNaN(fs) && fs > 0) fontSizes.add(fs);
        const fw = parseInt(s.fontWeight);
        if (!isNaN(fw)) fontWeights.add(fw);
        const lh = parseFloat(s.lineHeight);
        if (!isNaN(lh) && lh > 0) lineHeights.add(lh);
        const ls = parseFloat(s.letterSpacing);
        if (!isNaN(ls)) letterSpacings.add(ls);
        const br = parseFloat(s.borderRadius);
        if (!isNaN(br) && br > 0) borderRadiuses.add(br);
        if (s.boxShadow && s.boxShadow !== "none") boxShadows.add(s.boxShadow);
        for (const side of ["marginTop", "marginRight", "marginBottom", "marginLeft"]) {
          const v = parseFloat((s as any)[side]);
          if (!isNaN(v)) margins.push(v);
        }
        for (const side of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
          const v = parseFloat((s as any)[side]);
          if (!isNaN(v)) paddings.push(v);
        }
        const gap = parseFloat(s.gap || "0");
        if (!isNaN(gap) && gap > 0) gaps.add(gap);
        const op = parseFloat(s.opacity || "1");
        if (!isNaN(op) && op < 1) opacities.add(op);
      }

      const cssProps: Record<string, string> = {};
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              for (let pi = 0; pi < rule.style.length; pi++) {
                const prop = rule.style[pi];
                if (prop && prop.startsWith("--")) {
                  cssProps[prop] = rule.style.getPropertyValue(prop).trim();
                }
              }
            }
          }
        } catch {}
      }

      const colorPalette = {
        core: Array.from(colors).filter((c) => {
          const rgb = c.match(/\d+/g)?.map(Number);
          if (!rgb) return false;
          const [r, g, b] = rgb;
          return !(r === g && g === b);
        }).slice(0, 30),
        neutrals: Array.from(colors).filter((c) => {
          const rgb = c.match(/\d+/g)?.map(Number);
          if (!rgb) return false;
          const [r, g, b] = rgb;
          return Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
        }).slice(0, 20),
      };

      return {
        colors: {
          total: colors.size,
          palette: colorPalette,
        },
        typography: {
          fonts: Array.from(fontFamilies).slice(0, 10),
          sizes: Array.from(fontSizes).sort((a, b) => a - b),
          weights: Array.from(fontWeights).sort((a, b) => a - b),
          lineHeights: Array.from(lineHeights).sort((a, b) => a - b).slice(0, 10),
          letterSpacings: Array.from(letterSpacings).sort((a, b) => a - b).slice(0, 10),
        },
        spacing: {
          margins: [...new Set(margins)].sort((a, b) => a - b).slice(0, 20),
          paddings: [...new Set(paddings)].sort((a, b) => a - b).slice(0, 20),
          gaps: Array.from(gaps).sort((a, b) => a - b),
        },
        borders: {
          radius: Array.from(borderRadiuses).sort((a, b) => a - b).slice(0, 10),
          shadows: Array.from(boxShadows).slice(0, 10),
        },
        cssCustomProperties: Object.keys(cssProps).length > 0 ? cssProps : undefined,
        opacities: Array.from(opacities).sort((a, b) => a - b),
      };
    });

    const colorGroups = {
      colorsTotal: data.colors.total,
      fontCount: data.typography.fonts.length,
      sizeScaleSteps: data.typography.sizes.length,
      spacingValues: data.spacing.margins.length + data.spacing.paddings.length,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            ...colorGroups,
            designSystem: data,
            recommendations: [
              data.typography.sizes.length > 10 ? `Escala tipográfica grande: ${data.typography.sizes.length} tamanhos únicos (considere simplificar)` : undefined,
              data.colors.total > 30 ? `Muitas cores únicas: ${data.colors.total} (considere usar design tokens)` : undefined,
              data.cssCustomProperties ? `${Object.keys(data.cssCustomProperties).length} CSS custom properties encontradas` : "Nenhuma CSS custom property -- considere usar design tokens",
            ].filter(Boolean),
          }, null, 2),
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const analyzeCssTool: ToolDefinition = {
  name: "analyze_css",
  description:
    "Analisar CSS da página atual: custom properties declaradas, tokens usados vs não usados, fontes carregadas vs declaradas, cores hardcoded, seletores não utilizados, alta especificidade. Útil para auditoria de design system.",
  args: {},
  async execute() {
    const page = await getPage();
    console.error(`🎨 CSS tokens audit: ${page.url()}`);

    const customProperties: Record<string, string> = await page.evaluate(() => {
      const props: Record<string, string> = {};
      const extractFromSheet = (sheet: CSSStyleSheet) => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              const propNames = Array.from({ length: style.length }, (_, i) => style.item(i)).filter(
                Boolean,
              ) as string[];
              for (const prop of propNames) {
                if (prop.startsWith("--")) props[prop] = style.getPropertyValue(prop).trim();
              }
            } else if (rule instanceof CSSMediaRule) {
              for (const r of Array.from(rule.cssRules || [])) {
                if (r instanceof CSSStyleRule) {
                  const style = r.style;
                  const names = Array.from({ length: style.length }, (_, i) => style.item(i)).filter(
                    Boolean,
                  ) as string[];
                  for (const prop of names) {
                    if (prop.startsWith("--")) props[prop] = style.getPropertyValue(prop).trim();
                  }
                }
              }
            }
          }
        } catch {}
      };
      for (let i = 0; i < document.styleSheets.length; i++) {
        extractFromSheet(document.styleSheets[i]! as CSSStyleSheet);
      }
      return props;
    });

    const usedTokens: string[] = await page.evaluate(() => {
      const used = new Set<string>();
      const all = document.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        const style = getComputedStyle(all[i]!);
        for (let j = 0; j < style.length; j++) {
          const val = style.getPropertyValue(style[j]!);
          const refs = val.match(/var\(--[^,)]+/g);
          if (refs) refs.forEach((r) => used.add(r.replace("var(", "").trim()));
        }
      }
      return Array.from(used);
    });

    const fontData: { used: string[]; loaded: string[] } = await page.evaluate(() => {
      const usedSet = new Set<string>();
      const all = document.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        const ff = getComputedStyle(all[i]!).fontFamily;
        if (ff) {
          for (const f of ff.split(",")) {
            const name = f.trim().replace(/["']/g, "");
            if (
              name &&
              !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|initial|inherit|unset)$/i.test(
                name,
              )
            ) {
              usedSet.add(name);
            }
          }
        }
      }
      const loadedSet = new Set<string>();
      if (typeof (document as any).fonts?.ready !== "undefined") {
        Array.from((document as any).fonts as ArrayLike<{ family: string }>).forEach((f: any) =>
          loadedSet.add(f.family),
        );
      }
      return { used: Array.from(usedSet), loaded: Array.from(loadedSet) };
    });

    const missingFonts = fontData.used.filter(
      (f) => !fontData.loaded.some((lf) => lf.toLowerCase() === f.toLowerCase()),
    );

    const hardcodedColors: string[] = await page.evaluate(() => {
      const issues: string[] = [];
      const colorPattern = /(?<!var\s*--)[\"']?(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;
      const seen = new Set<string>();
      const all = document.querySelectorAll("*");
      const props = [
        "color",
        "backgroundColor",
        "borderColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
        "outlineColor",
      ] as const;
      for (let i = 0; i < all.length; i++) {
        const style = getComputedStyle(all[i]!);
        for (const prop of props) {
          const val = style[prop] as string | undefined;
          if (!val) continue;
          const match = val.match(colorPattern);
          if (match && !val.includes("var(--") && !seen.has(val)) {
            seen.add(val);
            const tag = all[i]!.tagName.toLowerCase();
            const id = all[i]!.id ? `#${all[i]!.id}` : "";
            const cls = Array.from(all[i]!.classList).join(".");
            issues.push(`Cor hardcoded ${match[0]} em ${prop} no ${tag}${id}${cls ? "." + cls : ""}`);
          }
        }
      }
      return issues.slice(0, 50);
    });

    const unusedSelectors: string[] = await page.evaluate(() => {
      const issues: string[] = [];
      const checked = new Set<string>();
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i] as CSSStyleSheet | null;
        if (!sheet) continue;
        try {
          const rules = Array.from(sheet.cssRules || []);
          const href = (sheet as any).href || `inline[${i}]`;
          for (const rule of rules) {
            if (!(rule instanceof CSSStyleRule)) continue;
            if (checked.has(rule.selectorText)) continue;
            checked.add(rule.selectorText);
            try {
              if (!document.querySelector(rule.selectorText)) {
                issues.push(`${rule.selectorText} (${href})`);
              }
            } catch {}
          }
        } catch {}
      }
      return issues;
    });

    const highSpecificity: string[] = await page.evaluate(() => {
      const issues: string[] = [];
      const pattern = /(#\w+.*){2,}|!important|\[.*\].*\[.*\]/;
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i]! as CSSStyleSheet | null;
        if (!sheet) continue;
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule && pattern.test(rule.selectorText)) {
              issues.push(`${rule.selectorText} (${(sheet as any).href || `inline[${i}]`})`);
            }
          }
        } catch {}
      }
      return issues.slice(0, 30);
    });

    const declaredCount = Object.keys(customProperties).length;
    const unusedCount = Math.max(0, declaredCount - usedTokens.length);

    const hasIssues =
      missingFonts.length > 0 ||
      hardcodedColors.length > 0 ||
      unusedSelectors.length > 0 ||
      highSpecificity.length > 0;
    const score = hasIssues
      ? Math.max(
          0,
          100 -
            missingFonts.length * 5 -
            hardcodedColors.length * 3 -
            unusedSelectors.length * 2 -
            highSpecificity.length * 2,
        )
      : 100;

    console.error(
      `✅ CSS: ${declaredCount} propriedades, ${unusedCount} não usadas, ${hardcodedColors.length} cores hardcoded`,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              score,
              customProperties,
              declaredTokens: declaredCount,
              unusedTokens: unusedCount,
              usedTokens,
              missingFonts,
              hardcodedColors,
              unusedSelectors: unusedSelectors.slice(0, 30),
              highSpecificitySelectors: highSpecificity,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};

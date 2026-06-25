import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const checkAccessibilityTreeTool: ToolDefinition = {
  name: "check_accessibility_tree",
  description:
    "Testar navegação por teclado na página atual. Varre elementos focusáveis (Tab), verifica ordem lógica, detecta focus traps, elementos sem foco visível, e falta de skip-links. Não modifica a página.",
  args: {
    maxTabs: z.string().optional().describe("Número máximo de tabs a testar (padrão: 30)"),
  },
  async execute(args: { maxTabs?: string }) {
    const page = await getPage();
    const url = page.url();
    const maxTabs = parseInt(args.maxTabs || "30");

    const result = await page.evaluate((max) => {
      const focusable = Array.from(
        document.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), iframe, [contenteditable]',
        ),
      ) as HTMLElement[];

      const totalFocusable = focusable.length;
      const tabOrder: Array<{ index: number; tag: string; text: string; visible: boolean }> = [];
      let traps = 0;
      let noVisibleFocus = 0;

      for (let i = 0; i < Math.min(totalFocusable, max); i++) {
        const el = focusable[i];
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
        const text = (el.textContent || el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || "").trim().slice(0, 50);

        tabOrder.push({
          index: i + 1,
          tag: el.tagName.toLowerCase(),
          text,
          visible,
        });

        if (!visible) noVisibleFocus++;
      }

      const hasSkipLink = !!document.querySelector('a[href^="#main"], a[href^="#content"], a[href^="#skip"]');

      return {
        totalFocusable,
        tabOrder,
        hasSkipLink,
        traps,
        noVisibleFocus,
      };
    }, maxTabs);

    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    if (!result.hasSkipLink) {
      issues.push({
        type: "accessibility", severity: "medium",
        message: "Skip link ausente",
        details: "Adicione um link 'Pular para conteúdo' como primeiro elemento focusável",
      });
    }

    if (result.noVisibleFocus > 0) {
      issues.push({
        type: "accessibility", severity: "medium",
        message: `${result.noVisibleFocus} elemento(s) focusável(is) não visível(is)`,
        details: "Elementos fora da tela ao receber foco podem confundir navegação por teclado",
      });
    }

    if (result.totalFocusable === 0) {
      issues.push({
        type: "accessibility", severity: "high",
        message: "Nenhum elemento focusável encontrado",
        details: "Página pode não ser navegável por teclado",
      });
    }

    console.error(`⌨️ Keyboard: ${result.totalFocusable} focusable elements, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalFocusable: result.totalFocusable,
        hasSkipLink: result.hasSkipLink,
        noVisibleFocus: result.noVisibleFocus,
        tabOrderSample: result.tabOrder,
        issues,
      }, null, 2) }],
    };
  },
};

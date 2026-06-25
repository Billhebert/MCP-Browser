import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const highlightTool: ToolDefinition = {
  name: "highlight",
  description:
    "Destacar visualmente um elemento na página do navegador com uma borda colorida e pulsante. Útil para você ver exatamente qual elemento será clicado/preenchido.",
  args: {
    selector: z.string().describe("Seletor CSS do elemento a destacar"),
    color: z
      .string()
      .optional()
      .describe("Cor da borda (ex: 'red', '#ff0000', 'blue'). Padrão: 'red'"),
  },
  async execute({ selector, color }: { selector: string; color?: string }) {
    const page = await getPage();
    const borderColor = color || "red";
    console.error(`🔦 Destacando: ${selector} (cor: ${borderColor})`);

    const count = await page.locator(selector).count();
    if (count === 0) {
      return {
        content: [{ type: "text", text: `Elemento não encontrado: ${selector}` }],
        isError: true,
      };
    }

    await page.evaluate(
      ({ selector, borderColor }: { selector: string; borderColor: string }) => {
        const el = document.querySelector(selector) as HTMLElement;
        if (!el) return;

        el.style.outline = `3px solid ${borderColor}`;
        el.style.outlineOffset = "2px";
        el.style.transition = "outline 0.3s ease";

        // Pulsating effect
        let visible = true;
        const interval = setInterval(() => {
          visible = !visible;
          el.style.outline = visible
            ? `3px solid ${borderColor}`
            : `3px solid transparent`;
        }, 500);

        // Remove highlight after 10 seconds
        setTimeout(() => {
          clearInterval(interval);
          el.style.outline = "";
          el.style.outlineOffset = "";
          el.style.transition = "";
        }, 10000);
      },
      { selector, borderColor },
    );

    console.error(`✅ Elemento destacado: ${selector}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            selector,
            color: borderColor,
            message: `Elemento destacado em ${borderColor} por 10 segundos`,
          }),
        },
      ],
    };
  },
};

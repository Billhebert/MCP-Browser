import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const highlightTool: ToolDefinition = {
  name: "highlight",
  description: "Highlight elements matching a CSS selector.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element a destacar"),
    color: z
      .string().max(100)
      .optional()
      .describe("Cor da borda (ex: 'red', '#ff0000', 'blue'). Padrão: 'red'"),
  },
  async execute({ selector, color }: { selector: string; color?: string }) {
    const page = await getPage();
    const borderColor = color || "red";
    console.error(`🔦 Highlighting: ${selector} (cor: ${borderColor})`);

    const count = await page.locator(selector).count();
    if (count === 0) {
      return {
        content: [{ type: "text", text: `Element não encontrado: ${selector}` }],
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

    console.error(`✅ element destacado: ${selector}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            selector,
            color: borderColor,
            message: `element destacado em ${borderColor} por 10 segundos`,
          }),
        },
      ],
    };
  },
};

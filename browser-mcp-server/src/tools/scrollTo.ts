import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const scrollToTool: ToolDefinition = {
  name: "scroll_to",
  description:
    "Rolar a página até um elemento específico ou para uma posição. Útil para carregar conteúdo lazy ou tornar um elemento visível.",
  args: {
    selector: z
      .string()
      .optional()
      .describe("Seletor CSS do elemento para rolar até ele"),
    position: z
      .enum(["top", "bottom", "center"])
      .optional()
      .describe("Posição: 'top' (início), 'bottom' (fim), 'center' (meio). Usar sem selector."),
    x: z.number().optional().describe("Coordenada X (pixels)"),
    y: z.number().optional().describe("Coordenada Y (pixels)"),
  },
  async execute(args: {
    selector?: string;
    position?: string;
    x?: number;
    y?: number;
  }) {
    const page = await getPage();
    console.error(`📜 Rolando página...`);

    if (args.selector) {
      await page.locator(args.selector).scrollIntoViewIfNeeded();
      console.error(`✅ Rolado até: ${args.selector}`);
    } else if (args.position === "top") {
      await page.evaluate(() => window.scrollTo(0, 0));
      console.error(`✅ Rolado para o topo`);
    } else if (args.position === "bottom") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      console.error(`✅ Rolado para o final`);
    } else if (args.position === "center") {
      await page.evaluate(
        () => window.scrollTo(0, document.body.scrollHeight / 2),
      );
      console.error(`✅ Rolado para o centro`);
    } else if (args.x !== undefined && args.y !== undefined) {
      await page.evaluate(
        ({ x, y }) => window.scrollTo(x, y),
        { x: args.x, y: args.y },
      );
      console.error(`✅ Rolado para (${args.x}, ${args.y})`);
    }

    await page.waitForTimeout(300);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true }),
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const getTextTool: ToolDefinition = {
  name: "get_text",
  description: "Extract visible text from an element using CSS selector.",
  args: {
    selector: z
      .string().max(2000)
      .optional()
      .describe("CSS selector optional. Se omitido, extrai o texto da page inteira."),
  },
  async execute({ selector }: { selector?: string }) {
    const page = await getPage();
    console.error(`📖 Extracting text${selector ? ` de: ${selector}` : " da página inteira"}...`);
    let text: string;
    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        return {
          content: [{ type: "text", text: `Element não encontrado: ${selector}` }],
          isError: true,
        };
      }
      text = (await el.textContent()) || "";
    } else {
      text = await page.evaluate(() => document.body.textContent);
    }
    const truncated = text.slice(0, 5000);
    console.error(`✅ Texto extraído: ${truncated.length} caracteres`);
    return {
      content: [
        {
          type: "text",
          text: truncated,
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const getHtmlTool: ToolDefinition = {
  name: "get_html",
  description: "Extract innerHTML or outerHTML from an element.",
  args: {
    selector: z
      .string().max(2000)
      .optional()
      .describe("CSS selector optional. Se omitido, extrai o HTML da page inteira."),
  },
  async execute({ selector }: { selector?: string }) {
    const page = await getPage();
    console.error(`🔍 Extraindo HTML${selector ? ` de: ${selector}` : " da página inteira"}...`);
    let html: string;
    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        return {
          content: [{ type: "text", text: `Element não encontrado: ${selector}` }],
          isError: true,
        };
      }
      html = await el.evaluate((el) => el.outerHTML);
    } else {
      html = await page.content();
    }
    const truncated = html.slice(0, 10000);
    console.error(`✅ HTML extraído: ${truncated.length} caracteres`);
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

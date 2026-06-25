import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const getHtmlTool: ToolDefinition = {
  name: "get_html",
  description:
    "Extrair o HTML da página toda ou de um elemento específico. Retorna até 10000 caracteres.",
  args: {
    selector: z
      .string()
      .optional()
      .describe("Seletor CSS opcional. Se omitido, extrai o HTML da página inteira."),
  },
  async execute({ selector }: { selector?: string }) {
    const page = await getPage();
    console.error(`🔍 Extraindo HTML${selector ? ` de: ${selector}` : " da página inteira"}...`);
    let html: string;
    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        return {
          content: [{ type: "text", text: `Elemento não encontrado: ${selector}` }],
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

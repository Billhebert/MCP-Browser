import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const getTextTool: ToolDefinition = {
  name: "get_text",
  description:
    "Extrair o texto visível da página toda ou de um elemento específico. Retorna até 5000 caracteres.",
  args: {
    selector: z
      .string()
      .optional()
      .describe("Seletor CSS opcional. Se omitido, extrai o texto da página inteira."),
  },
  async execute({ selector }: { selector?: string }) {
    const page = await getPage();
    console.error(`📖 Extraindo texto${selector ? ` de: ${selector}` : " da página inteira"}...`);
    let text: string;
    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        return {
          content: [{ type: "text", text: `Elemento não encontrado: ${selector}` }],
          isError: true,
        };
      }
      text = (await el.textContent()) || "";
    } else {
      text = await page.evaluate(() => document.body.innerText);
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

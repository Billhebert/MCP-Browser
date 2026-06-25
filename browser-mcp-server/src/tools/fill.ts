import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const fillTool: ToolDefinition = {
  name: "fill",
  description: "Preencher um campo de formulário com um valor.",
  args: {
    selector: z.string().describe("Seletor CSS do campo (ex: '#email', 'input[name=\"senha\"]')"),
    value: z.string().describe("Valor a ser preenchido"),
  },
  async execute({ selector, value }: { selector: string; value: string }) {
    console.error(`✏️  Preenchendo campo: ${selector}`);
    const page = await getPage();
    await page.fill(selector, value);
    console.error(`✅ Campo preenchido: ${selector}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            selector,
          }),
        },
      ],
    };
  },
};

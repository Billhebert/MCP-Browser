import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const selectTool: ToolDefinition = {
  name: "select",
  description: "Selecionar uma opção em um elemento <select>.",
  args: {
    selector: z.string().describe("Seletor CSS do elemento <select>"),
    value: z.string().describe("Valor da option a ser selecionada"),
  },
  async execute({ selector, value }: { selector: string; value: string }) {
    console.error(`📋 Selecionando: ${selector} = "${value}"`);
    const page = await getPage();
    await page.selectOption(selector, value);
    console.error(`✅ Opção selecionada: ${selector}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, selector, value }),
        },
      ],
    };
  },
};

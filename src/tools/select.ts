import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const selectTool: ToolDefinition = {
  name: "select",
  description: "Select an option in a select element by label or value.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element <select>"),
    value: z.string().max(5000).describe("Value da option a ser selecionada"),
  },
  async execute({ selector, value }: { selector: string; value: string }) {
    console.error(`📋 Selecting: ${selector} = "${value}"`);
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

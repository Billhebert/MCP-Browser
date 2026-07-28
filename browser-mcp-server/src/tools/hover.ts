import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const hoverTool: ToolDefinition = {
  name: "hover",
  description: "Hover mouse over an element using CSS selector.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element para passar o mouse"),
  },
  async execute({ selector }: { selector: string }) {
    const page = await getPage();
    console.error(`🖱️  Hover em: ${selector}`);
    await page.hover(selector);
    await page.waitForTimeout(300);
    console.error(`✅ Hover realizado: ${selector}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, selector, url: page.url() }),
        },
      ],
    };
  },
};

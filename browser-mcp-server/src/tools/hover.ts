import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const hoverTool: ToolDefinition = {
  name: "hover",
  description: "Passar o mouse sobre um elemento (útil para menus dropdown que aparecem no hover).",
  args: {
    selector: z.string().describe("Seletor CSS do elemento para passar o mouse"),
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

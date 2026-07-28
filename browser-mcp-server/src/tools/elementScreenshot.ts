import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const elementScreenshotTool: ToolDefinition = {
  name: "element_screenshot",
  description: "Capture a screenshot of a specific element.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element para capture"),
  },
  async execute({ selector }: { selector: string }) {
    const page = await getPage();
    console.error(`📸 Taking screenshot do element: ${selector}`);

    const locator = page.locator(selector).first();
    const count = await page.locator(selector).count();

    if (count === 0) {
      return {
        content: [{ type: "text", text: `Element não encontrado: ${selector}` }],
        isError: true,
      };
    }

    const screenshot = await locator.screenshot({ type: "png" });
    const base64 = screenshot.toString("base64");

    console.error(`✅ Screenshot do element: ${selector} (${base64.length} bytes)`);
    return {
      content: [
        { type: "image", data: base64, mimeType: "image/png" },
        {
          type: "text",
          text: `Screenshot do element: ${selector}`,
        },
      ],
    };
  },
};

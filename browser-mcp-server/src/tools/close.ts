import type { ToolDefinition } from "../types.js";
import { closeBrowser } from "../browser.js";

export const closeTool: ToolDefinition = {
  name: "close",
  description: "Close the current page or browser.",
  args: {},
  async execute() {
    console.error(`🔒 Closing browser...`);
    await closeBrowser();
    console.error(`✅ Browser fechado`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, message: "Browser fechado" }),
        },
      ],
    };
  },
};

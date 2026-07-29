import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const goBackTool: ToolDefinition = {
  name: "go_back",
  description: "Navigate back to the previous page.",
  args: {},
  async execute() {
    const page = await getPage();
    console.error(`⬅️  Going back para página anterior...`);
    await page.goBack({ waitUntil: "networkidle" });
    console.error(`✅ Voltei para: ${await page.title()}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            title: await page.title(),
            url: page.url(),
          }),
        },
      ],
    };
  },
};

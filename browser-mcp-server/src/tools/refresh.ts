import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const refreshTool: ToolDefinition = {
  name: "refresh",
  description: "Refresh the current page.",
  args: {},
  async execute() {
    const page = await getPage();
    console.error(`🔄 Recarregando página...`);
    await page.reload({ waitUntil: "networkidle" });
    console.error(`✅ Página recarregada: ${await page.title()}`);
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

import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const goBackTool: ToolDefinition = {
  name: "go_back",
  description: "Voltar para a página anterior no histórico do navegador.",
  args: {},
  async execute() {
    const page = await getPage();
    console.error(`⬅️  Voltando para página anterior...`);
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

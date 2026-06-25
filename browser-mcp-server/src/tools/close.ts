import type { ToolDefinition } from "../index.js";
import { closeBrowser } from "../browser.js";

export const closeTool: ToolDefinition = {
  name: "close",
  description: "Fechar o navegador e limpar a sessão. SÓ use se o usuário solicitar explicitamente.",
  args: {},
  async execute() {
    console.error(`🔒 Fechando navegador...`);
    await closeBrowser();
    console.error(`✅ Navegador fechado`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, message: "Navegador fechado" }),
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const navigateTool: ToolDefinition = {
  name: "navigate",
  description: "Navegar para uma URL. Retorna o título e URL atual da página.",
  args: {
    url: z.string().url().describe("URL completa para navegar (ex: https://exemplo.com)"),
  },
  async execute({ url }: { url: string }) {
    console.error(`🌐 Navegando para: ${url}`);
    const page = await getPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const title = await page.title();
    const currentUrl = page.url();
    console.error(`✅ Página carregada: "${title}" — ${currentUrl}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ title, url: currentUrl }),
        },
      ],
    };
  },
};

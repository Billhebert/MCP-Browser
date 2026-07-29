import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const setLocalStorageTool: ToolDefinition = {
  name: "set_local_storage",
  description: "Set localStorage items for the domain.",
  args: {
    items: z
      .record(z.string().max(50000))
      .describe("Objeto chave-valor para set no localStorage (ex: { 'token': 'abc', 'theme': 'dark' })"),
    url: z
      .string().max(5000)
      .optional()
      .describe(
        "URL para navigate primeiro (necessário para set localStorage de um domínio específico)",
      ),
  },
  async execute({ items, url }: { items: Record<string, string>; url?: string }) {
    const page = await getPage();
    console.error(`💾 Definindo ${Object.keys(items).length} itens no localStorage...`);

    if (url) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      console.error(`📍 Navegado para: ${url}`);
    }

    await page.evaluate((items) => {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(key, value);
      }
    }, items);

    if (url) {
      await page.reload({ waitUntil: "networkidle" });
      console.error(`✅ Página recarregada com localStorage definido`);
    }

    console.error(`✅ localStorage definido: ${Object.keys(items).length} itens`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            items: Object.keys(items),
          }),
        },
      ],
    };
  },
};

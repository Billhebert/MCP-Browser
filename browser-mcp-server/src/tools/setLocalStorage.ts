import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const setLocalStorageTool: ToolDefinition = {
  name: "set_local_storage",
  description:
    "Definir valores no localStorage do navegador antes de carregar uma página. Útil para configurar tokens, preferências ou flags de feature.",
  args: {
    items: z
      .record(z.string())
      .describe("Objeto chave-valor para definir no localStorage (ex: { 'token': 'abc', 'theme': 'dark' })"),
    url: z
      .string()
      .optional()
      .describe(
        "URL para navegar primeiro (necessário para definir localStorage de um domínio específico)",
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

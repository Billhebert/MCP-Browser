import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const getAttributesTool: ToolDefinition = {
  name: "get_attributes",
  description:
    "Obter todos os atributos de um elemento (id, class, aria-label, role, href, src, etc). Útil para descobrir seletores precisos.",
  args: {
    selector: z.string().describe("Seletor CSS do elemento"),
  },
  async execute({ selector }: { selector: string }) {
    const page = await getPage();
    console.error(`🏷️  Obtendo atributos de: ${selector}`);

    const el = page.locator(selector).first();
    const count = await page.locator(selector).count();

    if (count === 0) {
      return {
        content: [{ type: "text", text: `Elemento não encontrado: ${selector}` }],
        isError: true,
      };
    }

    const attrs = await el.evaluate((el) => {
      const attrs: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value;
      }
      attrs["tagName"] = (el as HTMLElement).tagName?.toLowerCase() || "";
      attrs["innerText"] = ((el as HTMLElement).innerText || "").trim().slice(0, 200);
      return attrs;
    });

    console.error(`✅ Atributos obtidos para: ${selector}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(attrs, null, 2),
        },
      ],
    };
  },
};

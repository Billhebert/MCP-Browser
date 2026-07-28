import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const getAttributesTool: ToolDefinition = {
  name: "get_attributes",
  description: "Get all attributes of an element by CSS selector.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element"),
  },
  async execute({ selector }: { selector: string }) {
    const page = await getPage();
    console.error(`🏷️  Obtendo atributos de: ${selector}`);

    const el = page.locator(selector).first();
    const count = await page.locator(selector).count();

    if (count === 0) {
      return {
        content: [{ type: "text", text: `Element não encontrado: ${selector}` }],
        isError: true,
      };
    }

    const attrs = await el.evaluate((el) => {
      const attrs: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value;
      }
      attrs["tagName"] = (el as HTMLElement).tagName?.toLowerCase() || "";
      attrs["innerText"] = ((el as HTMLElement).textContent || "").trim().slice(0, 200);
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

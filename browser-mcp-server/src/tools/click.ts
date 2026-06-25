import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const clickTool: ToolDefinition = {
  name: "click",
  description:
    "Clicar em um elemento da página usando seletor CSS. Se o clique normal falhar, tenta clique programático via JavaScript. Use force=true para ignorar verificações de visibility/enabled.",
  args: {
    selector: z.string().describe("Seletor CSS do elemento (ex: '#btn-login', '.menu-item', 'button:has-text(\"Kanban\")')"),
    force: z
      .boolean()
      .optional()
      .describe("Se true, ignora verificações de actionability e força o clique via JavaScript"),
  },
  async execute({ selector, force }: { selector: string; force?: boolean }) {
    const page = await getPage();
    console.error(`🖱️  Clicando em: ${selector}${force ? " (forçado)" : ""}`);

    if (force) {
      await page.$eval(selector, (el: HTMLElement) => el.click());
      console.error(`✅ Clique forçado via JS: ${selector}`);
    } else {
      try {
        await page.click(selector, { timeout: 5000 });
        console.error(`✅ Clique realizado: ${selector}`);
      } catch (err) {
        const msg = (err as Error).message;
        console.error(`⚠️  Clique normal falhou: ${msg}. Tentando clique programático...`);
        await page.$eval(selector, (el: HTMLElement) => el.click());
        console.error(`✅ Clique via JS fallback: ${selector}`);
      }
    }

    await page.waitForLoadState("networkidle").catch(() => {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, selector, force: !!force, url: page.url() }),
        },
      ],
    };
  },
};

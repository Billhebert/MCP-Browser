import type { ToolDefinition } from "../index.js";
import { getAllPages } from "../browser.js";

export const listTabsTool: ToolDefinition = {
  name: "list_tabs",
  description: "Listar todas as abas/janelas abertas no navegador com seus títulos e URLs.",
  args: {},
  async execute() {
    console.error(`📑 Listando abas abertas...`);
    const pages = await getAllPages();

    if (pages.length === 0) {
      return {
        content: [{ type: "text", text: "Nenhuma aba aberta." }],
      };
    }

    const results: Array<{ index: number; title: string; url: string }> = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      try {
        results.push({
          index: i,
          title: await p.title(),
          url: p.url(),
        });
      } catch {
        results.push({ index: i, title: "(fechada)", url: "(fechada)" });
      }
    }

    const text = results
      .map((r) => `[${r.index}] ${r.title}\n   ${r.url}`)
      .join("\n\n");

    const activeIndex = pages.findIndex((p) => !p.isClosed());
    console.error(`✅ ${pages.length} abas abertas, ativa: [${activeIndex}]`);
    return { content: [{ type: "text", text }] };
  },
};

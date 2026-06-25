import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getAllPages, setupPageListeners } from "../browser.js";

export const switchTabTool: ToolDefinition = {
  name: "switch_tab",
  description: "Mudar para uma aba específica pelo índice (use list_tabs para ver os índices).",
  args: {
    index: z
      .number()
      .int()
      .min(0)
      .describe("Índice da aba para ativar (0 = primeira aba)"),
  },
  async execute({ index }: { index: number }) {
    console.error(`📑 Mudando para aba [${index}]...`);
    const pages = await getAllPages();

    if (index >= pages.length) {
      return {
        content: [
          {
            type: "text",
            text: `Aba [${index}] não existe. Total de abas: ${pages.length}`,
          },
        ],
        isError: true,
      };
    }

    const target = pages[index];
    if (target.isClosed()) {
      return {
        content: [{ type: "text", text: `Aba [${index}] está fechada.` }],
        isError: true,
      };
    }

    await target.bringToFront();
    console.error(`✅ Mudou para aba [${index}]: ${await target.title()}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            index,
            title: await target.title(),
            url: target.url(),
          }),
        },
      ],
    };
  },
};

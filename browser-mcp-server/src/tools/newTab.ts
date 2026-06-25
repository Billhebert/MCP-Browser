import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getContext, setupPageListeners } from "../browser.js";

export const newTabTool: ToolDefinition = {
  name: "new_tab",
  description: "Abrir uma nova aba no navegador (a aba atual continua aberta).",
  args: {
    url: z
      .string()
      .url()
      .optional()
      .describe("URL opcional para navegar na nova aba"),
  },
  async execute({ url }: { url?: string }) {
    console.error(`📑 Abrindo nova aba${url ? ` para: ${url}` : ""}...`);
    const ctx = await getContext();
    const newPage = await ctx.newPage();
    await setupPageListeners(newPage);

    if (url) {
      await newPage.goto(url, { waitUntil: "networkidle" });
    }

    console.error(`✅ Nova aba aberta: ${await newPage.title() || "(vazia)"}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            title: await newPage.title(),
            url: newPage.url(),
          }),
        },
      ],
    };
  },
};

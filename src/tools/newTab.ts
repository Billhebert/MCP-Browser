import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getContext, setupPageListeners } from "../browser.js";

export const newTabTool: ToolDefinition = {
  name: "new_tab",
  description: "Open a new browser tab.",
  args: {
    url: z
      .string().max(5000)
      .url()
      .optional()
      .describe("URL optional para navigate na nova aba"),
  },
  async execute({ url }: { url?: string }) {
    console.error(`📑 Opening new tab${url ? ` para: ${url}` : ""}...`);
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

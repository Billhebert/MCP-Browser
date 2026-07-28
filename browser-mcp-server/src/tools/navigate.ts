import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const navigateTool: ToolDefinition = {
  name: "navigate",
  description: "Navigate to a URL. Returns page title and URL. Configurable timeout and wait strategy.",
  args: {
    url: z.string().max(5000).url().describe("URL withpleta para navigate (ex: https://exemplo.with)"),
    timeout: z
      .number()
      .int()
      .min(5000)
      .max(120000)
      .optional()
      .default(30000)
      .describe("Timeout em ms para carregamento (default: 30000)"),
  },
  async execute({ url, timeout }: { url: string; timeout?: number }) {
    console.error(`🌐 Navigating to: ${url}`);
    const page = await getPage();
    const t = timeout || 30000;

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: t });
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`⚠️  networkidle excedeu o tempo limite (${t}ms): ${msg.slice(0, 100)}`);
      console.error(`⚠️  Tentando com waitUntil: "load"...`);
      try {
        await page.goto(url, { waitUntil: "load", timeout: t });
      } catch (err2) {
        console.error(`⚠️  load também excedeu: ${(err2 as Error).message.slice(0, 100)}`);
        console.error(`⚠️  Tentando sem waitUntil...`);
        await page.goto(url, { timeout: t + 10000 }).catch(() => {});
      }
    }

    // Always wait a bit for SPA rendering
    await page.waitForTimeout(1000);

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

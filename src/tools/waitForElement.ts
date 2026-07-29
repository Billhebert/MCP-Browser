import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const waitForElementTool: ToolDefinition = {
  name: "wait_for_element",
  description: "Wait for an element to appear using CSS selector.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element para wait"),
    timeout: z
      .number()
      .int()
      .min(1000)
      .max(60000)
      .optional()
      .default(10000)
      .describe("Timeout maximum em ms (default: 10000)"),
    visible: z
      .boolean()
      .optional()
      .default(true)
      .describe("If true, aguarda o element estar visível (not only no DOM)"),
    interval: z
      .number()
      .int()
      .min(100)
      .max(5000)
      .optional()
      .default(300)
      .describe("Intervalo de polling em ms (default: 300)"),
  },
  async execute({ selector, timeout = 10000, visible = true, interval = 300 }: {
    selector: string;
    timeout?: number;
    visible?: boolean;
    interval?: number;
  }) {
    const page = await getPage();
    console.error(`⏳ Aguardando element: ${selector} (timeout: ${timeout}ms, visible: ${visible})`);

    const state = visible ? "visible" : "attached";
    const start = Date.now();

    try {
      await page.waitForSelector(selector, { state, timeout });
      const elapsed = Date.now() - start;
      console.error(`✅ element encontrado em ${elapsed}ms: ${selector}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ found: true, selector, elapsedMs: elapsed, visible }),
          },
        ],
      };
    } catch (err) {
      const elapsed = Date.now() - start;
      // Fallback: try polling manually
      console.error(`⚠️  waitForSelector falhou em ${elapsed}ms. Tentando polling manual...`);
      const pollStart = Date.now();
      let found = false;

      while (Date.now() - pollStart < timeout) {
        try {
          const count = await page.locator(selector).count();
          if (count > 0) {
            if (!visible) {
              found = true;
              break;
            }
            const isVisible = await page.locator(selector).first().isVisible();
            if (isVisible) {
              found = true;
              break;
            }
          }
        } catch {}
        await page.waitForTimeout(interval);
      }

      if (found) {
        const totalElapsed = Date.now() - start;
        console.error(`✅ element encontrado via polling em ${totalElapsed}ms: ${selector}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ found: true, selector, elapsedMs: totalElapsed, visible }),
            },
          ],
        };
      }

      console.error(`❌ Element não encontrado após ${timeout}ms: ${selector}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ found: false, selector, elapsedMs: Date.now() - start, timeout }),
          },
        ],
      };
    }
  },
};

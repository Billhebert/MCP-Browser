import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";
import { maskSensitiveRegions } from "../corporate/dataMasker.js";

async function detectSensitiveRegions(page: import("playwright").Page) {
  return page.evaluate(() => {
    const sensitive = document.querySelectorAll(
      'input[type="password"], input[type="email"], input[type="tel"], input[type="credit-card"], [autocomplete="cc-number"], [autocomplete="cc-exp"], [autocomplete="cc-csc"]',
    );
    return Array.from(sensitive)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })
      .filter((r) => r.width > 0 && r.height > 0);
  });
}

export const screenshotTool: ToolDefinition = {
  name: "screenshot",
  description: "Capture a screenshot of the current page as base64 image. Auto-masks sensitive regions (forms, inputs) by default. Use mask=false to disable.",
  args: {
    mask: z.boolean().optional().describe("Auto-blur sensitive regions. Default: true"),
    fullPage: z.boolean().optional().describe("Capture full scrollable page. Default: false"),
  },
  async execute(args: { mask?: boolean; fullPage?: boolean }) {
    const page = await getPage();
    const doMask = args.mask !== false;
    const fullPage = args.fullPage === true;

    console.error(`📸 Taking screenshot...`);
    let screenshot: Buffer;
    try {
      screenshot = await page.screenshot({ type: "png", fullPage });
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Screenshot failed: ${(err as Error).message}` }) }], isError: true };
    }
    let finalBuf = screenshot;

    if (doMask) {
      try {
        const sensitiveRegions = await detectSensitiveRegions(page);
        if (sensitiveRegions.length > 0) {
          finalBuf = await maskSensitiveRegions(screenshot, sensitiveRegions);
          console.error(`🛡️ Masked ${sensitiveRegions.length} sensitive region(s)`);
        }
      } catch (e) {
        console.error(`[Mask] Skipped: ${(e as Error).message}`);
      }
    }

    const base64 = finalBuf.toString("base64");
    console.error(`✅ Screenshot: ${screenshot.length} bytes → ${finalBuf.length} bytes (masked: ${doMask})`);
    return {
      content: [
        {
          type: "image",
          data: base64,
          mimeType: "image/png",
        },
        {
          type: "text",
          text: `Screenshot capturado: ${await page.title()} — ${page.url()}${doMask ? " (com data masking)" : ""}`,
        },
      ],
    };
  },
};

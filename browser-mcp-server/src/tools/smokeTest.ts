import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const smokeTestTool: ToolDefinition = {
  name: "smoke_test",
  description: "Run smoke tests: check essential elements and console errors.",
  args: {
    urls: z.string().max(5000).describe("JSON array de objetos: [{\"url\":\"https://...\",\"expectedText\":\"optional\",\"expectedStatus\":200}]"),
    screenshotOnFail: z.string().max(5000).optional().describe("Se 'true', captura screenshot em caso de falha"),
  },
  async execute(args: { urls: string; screenshotOnFail?: string }) {
    const page = await getPage();
    const urls: Array<{ url: string; expectedText?: string; expectedStatus?: number }> = JSON.parse(args.urls);
    const screenshotOnFail = args.screenshotOnFail === "true";

    const results: Array<{
      url: string;
      status: string;
      httpStatus: number | null;
      title: string;
      textFound: boolean | null;
      loadTimeMs: number;
      error?: string;
      screenshot?: string;
    }> = [];

    for (const target of urls) {
      const start = Date.now();
      try {
        const response = await page.goto(target.url, { waitUntil: "networkidle", timeout: 30000 });
        const loadTime = Date.now() - start;
        const httpStatus = response?.status() || null;
        const title = await page.title();
        const bodyText = await page.evaluate(() => document.body.textContent);

        const errors: string[] = [];
        if (target.expectedStatus && httpStatus !== target.expectedStatus) {
          errors.push(`Expected status ${target.expectedStatus}, got ${httpStatus}`);
        }
        if (httpStatus && httpStatus >= 400) {
          errors.push(`HTTP ${httpStatus}`);
        }
        const textFound = target.expectedText ? bodyText.includes(target.expectedText) : null;
        if (target.expectedText && !textFound) {
          errors.push(`Expected text "${target.expectedText}" not found`);
        }

        results.push({
          url: target.url,
          status: errors.length === 0 ? "pass" : "fail",
          httpStatus,
          title,
          textFound,
          loadTimeMs: loadTime,
          ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
        });
      } catch (err) {
        const loadTime = Date.now() - start;
        const result: typeof results[0] = {
          url: target.url,
          status: "fail",
          httpStatus: null,
          title: "",
          textFound: null,
          loadTimeMs: loadTime,
          error: (err as Error).message.slice(0, 200),
        };
        if (screenshotOnFail) {
          try { result.screenshot = (await page.screenshot({ type: "png" })).toString("base64"); } catch {}
        }
        results.push(result);
      }
    }

    const passCount = results.filter((r) => r.status === "pass").length;
    const failCount = results.filter((r) => r.status === "fail").length;
    console.error(`🔥 Smoke: ${passCount} pass, ${failCount} fail (${results.length} URLs)`);

    return {
      content: [{ type: "text", text: JSON.stringify({ total: results.length, passCount, failCount, results }, null, 2) }],
    };
  },
};

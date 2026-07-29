import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { chromium, firefox, webkit } from "playwright";

const BROWSERS = ["chromium", "firefox", "webkit"] as const;

export const testCrossBrowserTool: ToolDefinition = {
  name: "test_cross_browser",
  description: "Executa a mesma URL em múltiplos browseres (Chromium, Firefox, WebKit) e compara métricas: console errors, performance, screenshot, e elements visíveis. Retorna tabela comparativa com scores.",
  args: {
    url: z.string().max(5000).describe("URL para test"),
    browsers: z.string().max(100).optional().describe("Browsers separated por vírgula: chromium,firefox,webkit (default: todos)"),
    screenshot: z.string().max(10).optional().describe("Capturar screenshot de cada? 'true' ou 'false'"),
    timeout: z.string().max(10).optional().describe("Timeout por browser em ms (default: 30000)"),
  },
  async execute(args: { url: string; browsers?: string; screenshot?: string; timeout?: string }) {
    const url = args.url;
    const selected = args.browsers
      ? args.browsers.split(",").map((b) => b.trim().toLowerCase()).filter((b) => BROWSERS.includes(b as any))
      : [...BROWSERS];
    const captureScreenshot = args.screenshot !== "false";
    const timeout = parseInt(args.timeout || "30000");

    const results: Array<{
      browser: string;
      status: string;
      metrics: Record<string, any>;
      consoleErrors: number;
      screenshot?: string;
      error?: string;
    }> = [];

    for (const browserType of selected) {
      console.error(`🌐 Testando ${browserType}...`);
      const browser = await (browserType === "firefox" ? firefox : browserType === "webkit" ? webkit : chromium).launch({ headless: true });
      const context = await browser.newContext({ locale: "pt-BR" });
      const page = await context.newPage();
      const errors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      const startTime = Date.now();
      try {
        await page.goto(url, { waitUntil: "load", timeout });
        const loadTime = Date.now() - startTime;

        const perfData = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0] as any;
          const paint = performance.getEntriesByType("paint");
          return {
            fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0,
            domContentLoaded: nav?.domContentLoadedEventEnd || 0,
            loadEvent: nav?.loadEventEnd || 0,
            domInteractive: nav?.domInteractive || 0,
            resourceCount: performance.getEntriesByType("resource").length,
          };
        });

        const meta = {
          title: await page.title().catch(() => ""),
          h1Count: await page.evaluate(() => document.querySelectorAll("h1").length),
          wordCount: await page.evaluate(() => (document.body?.textContent || "").trim().split(/\s+/).length),
          hasMain: await page.evaluate(() => document.querySelectorAll("main, [role=main]").length > 0),
          viewportSize: await page.evaluate(() => `${window.innerWidth}x${window.innerHeight}`),
        };

        const entry: any = {
          browser: browserType,
          status: "success",
          metrics: {
            loadTimeMs: loadTime,
            fcp: `${(perfData.fcp / 1000).toFixed(1)}s`,
            domContentLoaded: `${(perfData.domContentLoaded / 1000).toFixed(1)}s`,
            domInteractive: `${(perfData.domInteractive / 1000).toFixed(1)}s`,
            resources: perfData.resourceCount,
            title: meta.title,
            h1Count: meta.h1Count,
            wordCount: meta.wordCount,
            hasMain: meta.hasMain,
            viewport: meta.viewportSize,
          },
          consoleErrors: errors.length,
        };

        if (captureScreenshot) {
          const buf = await page.screenshot({ fullPage: false });
          entry.screenshot = buf.toString("base64");
        }

        results.push(entry);
      } catch (err) {
        results.push({
          browser: browserType,
          status: "error",
          metrics: {},
          consoleErrors: errors.length,
          error: (err as Error).message,
        });
      } finally {
        await browser.close();
      }
    }

    const successful = results.filter((r) => r.status === "success");
    const performanceScores: Record<string, number> = {};
    for (const r of successful) {
      const loadMs = r.metrics.loadTimeMs;
      performanceScores[r.browser] = loadMs <= 2000 ? 90 : loadMs <= 5000 ? 60 : 30;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            browsersTested: selected.length,
            results,
            summary: {
              fastest: successful.length > 0 ? successful.reduce((a, b) => a.metrics.loadTimeMs < b.metrics.loadTimeMs ? a : b).browser : null,
              slowest: successful.length > 0 ? successful.reduce((a, b) => a.metrics.loadTimeMs > b.metrics.loadTimeMs ? a : b).browser : null,
              averageLoadTime: successful.length > 0 ? Math.round(successful.reduce((s, r) => s + r.metrics.loadTimeMs, 0) / successful.length) : null,
              totalErrors: results.reduce((s, r) => s + r.consoleErrors, 0),
              performanceScores,
            },
          }, null, 2),
        },
      ],
    };
  },
};

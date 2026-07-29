import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { chromium } from "playwright";

export const storybookPerfTool: ToolDefinition = {
  name: "storybook_perf",
  description: "Mede performance de cada story do Storybook (LCP, FCP, CLS, load time, resources). Retorna métricas por story e ranking dos componentes mais pesados.",
  args: {
    url: z.string().max(5000).describe("URL do Storybook (ex: http://localhost:6006)"),
    maxStories: z.string().max(10).optional().describe("Máximo de stories (default: 50)"),
  },
  async execute(args: { url: string; maxStories?: string }) {
    const sbUrl = args.url.replace(/\/$/, "");
    const maxStories = parseInt(args.maxStories || "50");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const results: Array<{
      story: string;
      metrics: Record<string, any>;
      score: number;
    }> = [];

    try {
      await page.goto(sbUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const storyLinks = await page.evaluate(() => {
        const items: string[] = [];
        document.querySelectorAll("a[href*='path=/story/']").forEach((a) => {
          const href = a.getAttribute("href") || "";
          const match = href.match(/path=\/story\/(.+)/);
          if (match) items.push(match[1]);
        });
        return [...new Set(items)].slice(0, 100);
      });

      const selected = storyLinks.slice(0, maxStories);

      for (const storyPath of selected) {
        const storyName = storyPath.replace(/--/g, " — ").replace(/-/g, " ").slice(0, 80);
        const storyUrl = `${sbUrl}/iframe.html?id=${storyPath}&viewMode=story`;

        try {
          await page.goto(storyUrl, { waitUntil: "load", timeout: 15000 });

          const metrics = await page.evaluate(() => {
            return new Promise<Record<string, any>>((resolve) => {
              const perf = performance;
              const nav = perf.getEntriesByType("navigation")[0] as any;
              const paint = perf.getEntriesByType("paint");

              const results: Record<string, any> = {
                fcp: paint.find((p: any) => p.name === "first-contentful-paint")?.startTime || 0,
                lcp: 0,
                cls: 0,
                domContentLoaded: nav?.domContentLoadedEventEnd || 0,
                loadEvent: nav?.loadEventEnd || 0,
                resourceCount: perf.getEntriesByType("resource").length,
                transferSize: 0,
              };

              const lcpObs = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                if (entries.length > 0) results.lcp = entries[entries.length - 1].startTime;
              });
              lcpObs.observe({ type: "largest-contentful-paint", buffered: true } as any);

              const clsObs = new PerformanceObserver((list) => {
                for (const e of list.getEntries()) {
                  results.cls += (e as any).value || 0;
                }
              });
              clsObs.observe({ type: "layout-shift", buffered: true } as any);

              setTimeout(() => {
                lcpObs.disconnect();
                clsObs.disconnect();
                const resources = perf.getEntriesByType("resource") as any[];
                results.transferSize = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
                resolve(results);
              }, 2000);
            });
          });

          const score = metrics.lcp <= 1500 ? 90 : metrics.lcp <= 3000 ? 60 : 30;

          results.push({
            story: storyName,
            metrics: {
              fcp: `${(metrics.fcp / 1000).toFixed(1)}s`,
              lcp: `${(metrics.lcp / 1000).toFixed(1)}s`,
              cls: metrics.cls.toFixed(3),
              loadEvent: `${(metrics.loadEvent / 1000).toFixed(1)}s`,
              resources: metrics.resourceCount,
              transferSize: `${(metrics.transferSize / 1024).toFixed(1)}KB`,
            },
            score,
          });
        } catch (err) {
          results.push({
            story: storyName,
            metrics: { error: (err as Error).message },
            score: 0,
          });
        }
      }

      const avgLoad = results.filter((r) => r.metrics.lcp).reduce((s, r) => s + parseFloat(r.metrics.lcp || "0"), 0) / results.length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              storybookUrl: sbUrl,
              totalStories: selected.length,
              averageLCP: `${avgLoad.toFixed(1)}s`,
              slowestStories: results.sort((a, b) => a.score - b.score).slice(0, 5).map((r) => ({
                story: r.story,
                lcp: r.metrics.lcp,
                score: r.score,
              })),
              results,
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Perf scan failed: ${(err as Error).message}` }) }],
        isError: true,
      };
    } finally {
      await browser.close();
    }
  },
};

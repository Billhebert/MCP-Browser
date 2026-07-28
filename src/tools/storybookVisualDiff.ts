import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const BASELINE_DIR = path.join(os.homedir(), ".bvp-storybook-baselines");

export const storybookVisualDiffTool: ToolDefinition = {
  name: "storybook_visual_diff",
  description: "Teste de regressão visual para todas as stories de um Storybook. Captura screenshot de cada story e compara com baseline. Retorna diff images, scores, e lista de regressões.",
  args: {
    url: z.string().max(5000).describe("URL do Storybook (ex: http://localhost:6006)"),
    maxStories: z.string().max(10).optional().describe("Máximo de stories (default: 30)"),
    threshold: z.string().max(10).optional().describe("Threshold de diff 0-1 (default: 0.1)"),
    updateBaselines: z.string().max(10).optional().describe("Forçar currentização dos baselines? 'true' ou 'false'"),
  },
  async execute(args: { url: string; maxStories?: string; threshold?: string; updateBaselines?: string }) {
    const sbUrl = args.url.replace(/\/$/, "");
    const maxStories = parseInt(args.maxStories || "30");
    const threshold = parseFloat(args.threshold || "0.1");
    const updateBaselines = args.updateBaselines === "true";

    if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const results: Array<{
      story: string;
      status: string;
      diffPercent: number;
      score: number;
      diffImage?: string;
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
        const safeName = storyPath.replace(/[^a-zA-Z0-9_-]/g, "_");
        const baselinePath = path.join(BASELINE_DIR, `${safeName}.png`);
        const diffPath = path.join(BASELINE_DIR, `${safeName}.diff.png`);

        console.error(`📸 Visual diff: ${storyName}`);

        try {
          const storyUrl = `${sbUrl}/iframe.html?id=${storyPath}&viewMode=story`;
          await page.goto(storyUrl, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(500);
          const screenshot = await page.screenshot({ fullPage: true });

          if (!fs.existsSync(baselinePath) || updateBaselines) {
            fs.writeFileSync(baselinePath, screenshot);
            results.push({ story: storyName, status: "baseline_created", diffPercent: 0, score: 100 });
            continue;
          }

          const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
          const img2 = PNG.sync.read(screenshot);
          const width = Math.max(img1.width, img2.width);
          const height = Math.max(img1.height, img2.height);
          const diff = new PNG({ width, height });
          const mismatched = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold });
          const diffPercent = (mismatched / (width * height)) * 100;
          const score = Math.max(0, 100 - diffPercent * 5);

          const entry: any = {
            story: storyName,
            status: mismatched === 0 ? "identical" : diffPercent < 1 ? "minor" : diffPercent < 5 ? "moderate" : "major",
            diffPercent: parseFloat(diffPercent.toFixed(2)),
            score: Math.round(score),
          };

          if (mismatched > 0) {
            const diffBuffer = PNG.sync.write(diff);
            fs.writeFileSync(diffPath, diffBuffer);
            entry.diffImage = diffBuffer.toString("base64");
          }

          results.push(entry);
        } catch (err) {
          results.push({ story: storyName, status: "error", diffPercent: 0, score: 0 });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              storybookUrl: sbUrl,
              totalStories: selected.length,
              passed: results.filter((r) => r.status === "identical" || r.status === "baseline_created").length,
              regressions: results.filter((r) => r.status === "major" || r.status === "moderate").length,
              averageScore: Math.round(results.reduce((s, r) => s + r.score, 0) / results.length),
              results,
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Visual diff failed: ${(err as Error).message}` }) }],
        isError: true,
      };
    } finally {
      await browser.close();
    }
  },
};

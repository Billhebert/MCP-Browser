import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const BASELINE_DIR = path.join(os.homedir(), ".bvp-visual-baselines");

export const testVisualRegressionTool: ToolDefinition = {
  name: "test_visual_regression",
  description: "Compara screenshot current com baseline salvo. Se não existe baseline, cria um. Retorna diff image + diff pixel count + score. Ideal para detectar regressões visuais.",
  args: {
    name: z.string().max(200).describe("Name único para este teste visual (ex: 'homepage')"),
    threshold: z.string().max(20).optional().describe("Threshold de diferença 0-1 (default: 0.1)"),
    fullPage: z.string().max(10).optional().describe("Capturar página inteira? 'true' ou 'false' (padrão: 'true')"),
    updateBaseline: z.string().max(10).optional().describe("Forçar currentização do baseline mesmo se existir? 'true' ou 'false'"),
  },
  async execute(args: { name: string; threshold?: string; fullPage?: string; updateBaseline?: string }) {
    const page = await getPage();
    const url = page.url();
    const testName = args.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const threshold = parseFloat(args.threshold || "0.1");
    const fullPage = args.fullPage !== "false";
    const updateBaseline = args.updateBaseline === "true";

    if (!fs.existsSync(BASELINE_DIR)) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
    }

    const baselinePath = path.join(BASELINE_DIR, `${testName}.png`);
    const diffPath = path.join(BASELINE_DIR, `${testName}.diff.png`);

    const currentScreenshot = await page.screenshot({ fullPage });

    if (!fs.existsSync(baselinePath) || updateBaseline) {
      fs.writeFileSync(baselinePath, currentScreenshot);
      console.error(`📸 Baseline criada: ${testName}`);
      return {
        content: [
          { type: "text", text: JSON.stringify({ url, testName, status: "baseline_created", message: `Baseline salva em ${baselinePath}` }, null, 2) },
        ],
      };
    }

    const baselineBuffer = fs.readFileSync(baselinePath);
    const img1 = PNG.sync.read(baselineBuffer);
    const img2 = PNG.sync.read(currentScreenshot);

    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);
    const diff = new PNG({ width, height });

    const mismatched = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold });
    const totalPixels = width * height;
    const diffPercent = (mismatched / totalPixels) * 100;
    const score = Math.max(0, Math.min(100, 100 - diffPercent * 5));

    const diffBuffer = PNG.sync.write(diff);
    fs.writeFileSync(diffPath, diffBuffer);

    console.error(`📊 Visual diff: ${mismatched} pixels diferentes (${diffPercent.toFixed(2)}%)`);

    const status = mismatched === 0 ? "identical" : diffPercent < 1 ? "minor" : diffPercent < 5 ? "moderate" : "major";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            testName,
            status,
            score: Math.round(score),
            pixelsDifferent: mismatched,
            totalPixels,
            diffPercent: parseFloat(diffPercent.toFixed(2)),
            threshold,
            baselineImage: baselineBuffer.toString("base64"),
            diffImage: status !== "identical" ? diffBuffer.toString("base64") : undefined,
          }, null, 2),
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";
import { getSnapshots } from "./saveSnapshot.js";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export const visualDiffTool: ToolDefinition = {
  name: "visual_diff",
  description:
    "Comparar screenshot atual da página com um snapshot salvo anteriormente (via save_snapshot). Gera diff visual usando pixelmatch, retorna % de diferença e imagem diff em base64. Útil para detectar mudanças visuais após ações.",
  args: {
    snapshotName: z.string().describe("Nome do snapshot salvo anteriormente para comparar"),
    threshold: z.string().optional().describe("Threshold de diferença (0.0-1.0, padrão: 0.02 = 2%)"),
  },
  async execute(args: { snapshotName: string; threshold?: string }) {
    const page = await getPage();
    const snapshotName = args.snapshotName;
    const threshold = parseFloat(args.threshold || "0.02");

    console.error(`👁 Visual diff: comparando com "${snapshotName}"`);

    const snapshotsStore = getSnapshots();
    const baseline = snapshotsStore.get(snapshotName);
    if (!baseline) {
      return {
        content: [{ type: "text", text: `Snapshot "${snapshotName}" não encontrado. Use save_snapshot primeiro.` }],
        isError: true,
      };
    }

    if (baseline.url !== page.url()) {
      console.error(`  ⚠️  URLs diferentes: snapshot=${baseline.url} atual=${page.url()}`);
    }

    const baselineBuf = Buffer.from(baseline.screenshot, "base64");
    const currentBuf = await page.screenshot({ type: "png" });

    const img1 = PNG.sync.read(baselineBuf);
    const img2 = PNG.sync.read(currentBuf);

    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    const padded1 = new PNG({ width, height, fill: true });
    const padded2 = new PNG({ width, height, fill: true });
    PNG.bitblt(img1, padded1, 0, 0, img1.width, img1.height, 0, 0);
    PNG.bitblt(img2, padded2, 0, 0, img2.width, img2.height, 0, 0);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(padded1.data, padded2.data, diff.data, width, height, {
      threshold,
      alpha: 0.3,
      diffColor: [255, 0, 0],
    });

    const totalPixels = width * height;
    const diffPercent = parseFloat(((diffPixels / totalPixels) * 100).toFixed(2));
    const diffImage = PNG.sync.write(diff);
    const diffBase64 = diffImage.toString("base64");
    const passed = diffPercent <= threshold * 100;

    console.error(`✅ Diff: ${diffPercent}% (threshold: ${(threshold * 100).toFixed(1)}%) ${passed ? "PASS" : "FAIL"}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              snapshotName,
              baselineUrl: baseline.url,
              currentUrl: page.url(),
              diffPercent,
              threshold: threshold * 100,
              passed,
              baselineTitle: baseline.title,
              currentTitle: await page.title(),
            },
            null,
            2,
          ),
        },
        { type: "image", data: diffBase64, mimeType: "image/png" },
        {
          type: "text",
          text: `🟥 Vermelho = diferenças detectadas (${diffPercent}% do total de pixels)`,
        },
      ],
    };
  },
};

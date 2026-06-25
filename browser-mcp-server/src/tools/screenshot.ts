import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";
import { maskSensitiveRegions, findSensitiveRegions } from "../corporate/dataMasker.js";

export const screenshotTool: ToolDefinition = {
  name: "screenshot",
  description:
    "Capturar um screenshot da página atual. Retorna como imagem base64. Modo 'corporate' (padrão detecta automaticamente regiões sensíveis como formulários e aplica blur). Use mask=false para desabilitar.",
  args: {
    mask: z.string().optional().describe("Se 'false' desabilita blur automático em áreas sensíveis. Padrão: detecta automático"),
    fullPage: z.string().optional().describe("Se 'true', captura página completa (rolável). Padrão: 'false'"),
  },
  async execute(args: { mask?: string; fullPage?: string }) {
    const page = await getPage();
    const doMask = args.mask !== "false";
    const fullPage = args.fullPage === "true";

    console.error(`📸 Capturando screenshot...`);
    const screenshot = await page.screenshot({ type: "png", fullPage });
    let finalBuf = screenshot;

    if (doMask) {
      try {
        const sensitiveRegions = await findSensitiveRegions(screenshot);
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

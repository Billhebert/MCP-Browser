import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const setViewportTool: ToolDefinition = {
  name: "set_viewport",
  description:
    "Alterar o tamanho da janela do navegador para emular dispositivos. Predefinições: 'desktop' (1920x1080), 'tablet' (768x1024), 'mobile' (375x667). Ou especifique width e height manualmente.",
  args: {
    device: z
      .enum(["desktop", "tablet", "mobile"])
      .optional()
      .describe("Dispositivo predefinido: 'desktop', 'tablet', 'mobile'"),
    width: z.number().int().min(320).max(3840).optional().describe("Largura em pixels"),
    height: z.number().int().min(240).max(2160).optional().describe("Altura em pixels"),
  },
  async execute(args: { device?: string; width?: number; height?: number }) {
    const page = await getPage();
    let w = 1280;
    let h = 720;

    if (args.device === "desktop") { w = 1920; h = 1080; }
    else if (args.device === "tablet") { w = 768; h = 1024; }
    else if (args.device === "mobile") { w = 375; h = 667; }
    else {
      if (args.width) w = args.width;
      if (args.height) h = args.height;
    }

    const deviceName = args.device || `${w}x${h}`;
    console.error(`📐 Alterando viewport para: ${deviceName} (${w}x${h})`);

    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);

    console.error(`✅ Viewport alterado: ${w}x${h}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            device: args.device || null,
            width: w,
            height: h,
          }),
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const analyzeResponsiveTool: ToolDefinition = {
  name: "analyze_responsive",
  description:
    "Testar responsividade da página atual em múltiplos viewports. Tira screenshots em cada tamanho especificado e retorna como imagens base64 com metadados.",
  args: {
    viewports: z.string().optional().describe("JSON array de viewports: [{\"width\":375,\"height\":667,\"name\":\"mobile\"}, ...]. Padrão: mobile(375x667), tablet(768x1024), desktop(1440x900)"),
  },
  async execute(args: { viewports?: string }) {
    const page = await getPage();
    const url = page.url();
    const defaultViewports = [
      { width: 375, height: 667, name: "mobile" },
      { width: 768, height: 1024, name: "tablet" },
      { width: 1440, height: 900, name: "desktop" },
    ];
    const viewports = args.viewports ? JSON.parse(args.viewports) as Array<{ width: number; height: number; name: string }> : defaultViewports;

    const results: Array<{ name: string; width: number; height: number; screenshot: string; contentLength: number }> = [];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      const screenshot = await page.screenshot({ type: "png", fullPage: false });
      const base64 = screenshot.toString("base64");
      results.push({
        name: vp.name,
        width: vp.width,
        height: vp.height,
        screenshot: base64,
        contentLength: screenshot.length,
      });
    }

    const summary = results.map((r) => `${r.name} ${r.width}x${r.height} (${Math.round(r.contentLength / 1024)}KB)`).join(", ");
    console.error(`📱 Responsive: ${summary}`);

    return {
      content: [
        { type: "text", text: JSON.stringify(results.map((r) => ({
          name: r.name,
          width: r.width,
          height: r.height,
          contentLength: r.contentLength,
        })), null, 2) },
        ...results.map((r) => ({
          type: "image" as const,
          data: r.screenshot,
          mimeType: "image/png" as const,
        })),
      ],
    };
  },
};

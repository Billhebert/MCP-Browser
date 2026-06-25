import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const elementScreenshotTool: ToolDefinition = {
  name: "element_screenshot",
  description:
    "Capturar screenshot de UM elemento específico da página (não a página toda). Útil para ver detalhes de um botão, modal, campo, etc.",
  args: {
    selector: z.string().describe("Seletor CSS do elemento para capturar"),
  },
  async execute({ selector }: { selector: string }) {
    const page = await getPage();
    console.error(`📸 Capturando screenshot do elemento: ${selector}`);

    const locator = page.locator(selector).first();
    const count = await page.locator(selector).count();

    if (count === 0) {
      return {
        content: [{ type: "text", text: `Elemento não encontrado: ${selector}` }],
        isError: true,
      };
    }

    const screenshot = await locator.screenshot({ type: "png" });
    const base64 = screenshot.toString("base64");

    console.error(`✅ Screenshot do elemento: ${selector} (${base64.length} bytes)`);
    return {
      content: [
        { type: "image", data: base64, mimeType: "image/png" },
        {
          type: "text",
          text: `Screenshot do elemento: ${selector}`,
        },
      ],
    };
  },
};

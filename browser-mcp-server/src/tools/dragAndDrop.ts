import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const dragAndDropTool: ToolDefinition = {
  name: "drag_and_drop",
  description:
    "Arrastar um elemento e soltar sobre outro. Útil para Kanban (mover cards entre colunas), reordenar listas, etc.",
  args: {
    source: z.string().describe("Seletor CSS do elemento a ser arrastado"),
    target: z.string().describe("Seletor CSS do elemento de destino (onde soltar)"),
  },
  async execute({ source, target }: { source: string; target: string }) {
    const page = await getPage();
    console.error(`🔄 Arrastando: ${source} → ${target}`);

    const srcEl = page.locator(source).first();
    const tgtEl = page.locator(target).first();

    const srcBox = await srcEl.boundingBox();
    const tgtBox = await tgtEl.boundingBox();

    if (!srcBox || !tgtBox) {
      return {
        content: [{ type: "text", text: "Não foi possível determinar a posição dos elementos." }],
        isError: true,
      };
    }

    await page.mouse.move(
      srcBox.x + srcBox.width / 2,
      srcBox.y + srcBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      tgtBox.x + tgtBox.width / 2,
      tgtBox.y + tgtBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();

    await page.waitForTimeout(500);
    console.error(`✅ Drag and drop concluído: ${source} → ${target}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, source, target }),
        },
      ],
    };
  },
};

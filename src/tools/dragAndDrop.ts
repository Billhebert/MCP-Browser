import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, getCDPSession } from "../browser.js";

export const dragAndDropTool: ToolDefinition = {
  name: "drag_and_drop",
  description: "Drag an element and drop onto a target.",
  args: {
    source: z.string().max(2000).describe("CSS selector do element a ser arrastado"),
    target: z.string().max(2000).describe("CSS selector do element de destino (where soltar)"),
  },
  async execute({ source, target }: { source: string; target: string }) {
    const page = await getPage();
    console.error(`🔄 Dragging: ${source} → ${target}`);

    const srcEl = page.locator(source).first();
    const tgtEl = page.locator(target).first();

    const srcBox = await srcEl.boundingBox();
    const tgtBox = await tgtEl.boundingBox();

    if (!srcBox || !tgtBox) {
      return {
        content: [{ type: "text", text: "Não foi possível determinar a posição dos elements." }],
        isError: true,
      };
    }

    const sx = Math.round(srcBox.x + srcBox.width / 2);
    const sy = Math.round(srcBox.y + srcBox.height / 2);
    const tx = Math.round(tgtBox.x + tgtBox.width / 2);
    const ty = Math.round(tgtBox.y + tgtBox.height / 2);

    let dragged = false;

    // ── Strategy 1: CDP-based mouse simulation (protocol-level, works with Vue/React DnD) ──
    try {
      const cdp = await getCDPSession(page);

      // Ensure element is draggable (Vue Slicksort checks for draggable attribute)
      await srcEl.evaluate((el: HTMLElement) => {
        el.draggable = true;
        el.style.userSelect = "none";
      });

      // CDP: mouse down on source
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: sx, y: sy,
        button: "left",
        clickCount: 1,
        modifiers: 0,
      });
      await page.waitForTimeout(100);

      // CDP: smooth move to target (dispatches real mousemove events that trigger HTML5 DnD)
      const steps = 15;
      for (let i = 1; i <= steps; i++) {
        const x = Math.round(sx + (tx - sx) * (i / steps));
        const y = Math.round(sy + (ty - sy) * (i / steps));
        await cdp.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x, y,
          button: "left",
          modifiers: 0,
        });
        await page.waitForTimeout(20);
      }

      // CDP: mouse up on target
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: tx, y: ty,
        button: "left",
        clickCount: 1,
        modifiers: 0,
      });

      await page.waitForTimeout(500);
      dragged = true;
      console.error(`✅ Drag and drop via CDP: ${source} → ${target}`);
    } catch (err) {
      console.error(`⚠️  CDP drag falhou: ${(err as Error).message.slice(0, 100)}`);
    }

    // ── Strategy 2: Playwright mouse API (fallback) ──
    if (!dragged) {
      try {
        await page.mouse.move(sx, sy);
        await page.mouse.down();
        await page.mouse.move(tx, ty, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        dragged = true;
        console.error(`✅ Drag and drop via mouse API: ${source} → ${target}`);
      } catch (err) {
        console.error(`⚠️  Mouse API drag falhou: ${(err as Error).message.slice(0, 100)}`);
      }
    }

    // ── Strategy 3: Dispatch DragEvent sequence (framework fallback) ──
    if (!dragged) {
      try {
        const tgtHandle = await tgtEl.elementHandle();
        if (tgtHandle) {
          await srcEl.evaluate((src: Element, tgt: Element) => {
            const dt = new DataTransfer();
            dt.effectAllowed = "move";
            dt.setData("text/plain", (src as HTMLElement).dataset?.id || "");

            src.dispatchEvent(new DragEvent("dragstart", {
              bubbles: true, cancelable: true, dataTransfer: dt,
            }));

            tgt.dispatchEvent(new DragEvent("dragenter", {
              bubbles: true, cancelable: true, dataTransfer: dt,
            }));

            tgt.dispatchEvent(new DragEvent("dragover", {
              bubbles: true, cancelable: true, dataTransfer: dt,
            }));

            tgt.dispatchEvent(new DragEvent("drop", {
              bubbles: true, cancelable: true, dataTransfer: dt,
            }));

            src.dispatchEvent(new DragEvent("dragend", {
              bubbles: true, cancelable: true, dataTransfer: dt,
            }));
          }, tgtHandle);
          await page.waitForTimeout(500);
          dragged = true;
          console.error(`✅ DragEvent dispatch: ${source} → ${target}`);
        }
      } catch (err) {
        console.error(`❌ All strategieségias de drag falharam: ${(err as Error).message}`);
        return {
          content: [{ type: "text", text: `Drag and drop falhou: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    // Verify the move by checking element position
    const newBox = await srcEl.boundingBox();
    const moved = newBox && (Math.abs(newBox.x - tx) > 20 || Math.abs(newBox.y - ty) > 20);

    console.error(`✅ Drag and drop concluído: ${source} → ${target}${moved ? "" : " (posição pode não ter mudado)"}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            source, target,
            positionChanged: !!moved,
          }),
        },
      ],
    };
  },
};

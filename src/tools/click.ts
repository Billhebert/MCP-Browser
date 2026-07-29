import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const clickTool: ToolDefinition = {
  name: "click",
  description: "Click an element using CSS selector. Automatic fallback: Playwright click then JavaScript dispatchEvent.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do element (ex: '#btn-login', '.menu-item', 'button:has-text(\"Kanban\")')"),
    force: z
      .boolean()
      .optional()
      .describe("If true, ignora verificações de actionability e força o clique via dispatchEvent"),
  },
  async execute({ selector, force }: { selector: string; force?: boolean }) {
    const page = await getPage();
    console.error(`🖱️  Clicking on: ${selector}${force ? " (forçado)" : ""}`);

    let clicked = false;
    let lastError = "";

    // Strategy 1: Normal Playwright click (waits for actionability)
    if (!force) {
      try {
        await page.click(selector, { timeout: 5000 });
        clicked = true;
        console.error(`✅ Clique normal: ${selector}`);
      } catch (err) {
        lastError = (err as Error).message;
        console.error(`⚠️  Clique normal falhou: ${lastError.slice(0, 100)}`);
      }
    }

    // Strategy 2: Force click via el.click()
    if (!clicked) {
      try {
        await page.$eval(selector, (el: HTMLElement) => el.click());
        clicked = true;
        console.error(`✅ Clique via JS (el.click()): ${selector}`);
      } catch (err) {
        lastError = (err as Error).message;
        console.error(`⚠️  Clique JS falhou: ${lastError.slice(0, 100)}`);
      }
    }

    // Strategy 3: Dispatch native MouseEvent on the element and its closest interactive ancestor
    if (!clicked) {
      try {
        await page.$eval(selector, (el: Element) => {
          const target = el || document;
          // Try element itself
          target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
          target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          // Try parent anchor/button if element itself isn't interactive
          const parent = (el as HTMLElement).closest?.("a, button, [role=button], [onclick]");
          if (parent && parent !== el) {
            parent.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          }
        });
        clicked = true;
        console.error(`✅ Clique via dispatchEvent: ${selector}`);
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    if (!clicked) {
      console.error(`❌ All click strategies failed for: ${selector}`);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Failed to click "${selector}"`, lastError, selector }) }],
        isError: true,
      };
    }

    await page.waitForTimeout(300);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, selector, force: !!force, url: page.url() }),
        },
      ],
    };
  },
};

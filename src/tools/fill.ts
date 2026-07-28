import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const fillTool: ToolDefinition = {
  name: "fill",
  description: "Fill a form field using CSS selector. Fallback strategies: Playwright fill, type, value set.",
  args: {
    selector: z.string().max(2000).describe("CSS selector do campo (ex: '#email', 'input[name=\"senha\"]')"),
    value: z.string().max(5000).describe("Value a ser preenchido"),
  },
  async execute({ selector, value }: { selector: string; value: string }) {
    console.error(`✏️  Filling field: ${selector}`);
    const page = await getPage();

    let filled = false;
    let lastError = "";

    // Strategy 1: Normal Playwright fill (clears + types)
    try {
      await page.fill(selector, value, { timeout: 5000 });
      filled = true;
      console.error(`✅ Campo preenchido (fill): ${selector}`);
    } catch (err) {
      lastError = (err as Error).message;
      console.error(`⚠️  Fill normal falhou: ${lastError.slice(0, 100)}`);
    }

    // Strategy 2: Clear + type character by character
    if (!filled) {
      try {
        const el = page.locator(selector).first();
        await el.evaluate((e: HTMLInputElement) => { e.value = ""; });
        await el.click();
        await page.keyboard.type(value, { delay: 10 });
        filled = true;
        console.error(`✅ Campo preenchido (keyboard.type): ${selector}`);
      } catch (err) {
        lastError = (err as Error).message;
        console.error(`⚠️  Type fallback falhou: ${lastError.slice(0, 100)}`);
      }
    }

    // Strategy 3: Dispatch native InputEvent
    if (!filled) {
      try {
        await page.$eval(selector, (el: HTMLInputElement, val: string) => {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value"
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
        filled = true;
        console.error(`✅ Campo preenchido (InputEvent): ${selector}`);
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    if (!filled) {
      console.error(`❌ All strategieségias de fill falharam para: ${selector}`);
      return {
        content: [{ type: "text", text: `Error filling "${selector}": ${lastError}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, selector }),
        },
      ],
    };
  },
};

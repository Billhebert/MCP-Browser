import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

// Map single chars to KeyboardEvent.code values
const CHAR_TO_CODE: Record<string, string> = {
  "/": "Slash", "\\": "Backslash", ".": "Period", ",": "Comma",
  ";": "Semicolon", "'": "Quote", "[": "BracketLeft", "]": "BracketRight",
  "`": "Backquote", "-": "Minus", "=": "Equal",
  " ": "Space",
};

export const pressKeyTool: ToolDefinition = {
  name: "press_key",
  description: "Press a keyboard key. Supports shortcuts like Ctrl+C, Meta+K.",
  args: {
    key: z.string().max(5000).describe("Tecla a pressionar (ex: 'Enter', 'Escape', 'Ctrl+K', 'Ctrl+Shift+P', 'Ctrl+?')"),
    selector: z
      .string().max(2000)
      .optional()
      .describe("CSS selector optional. Se omitido, pressiona no element ativo."),
  },
  async execute({ key, selector }: { key: string; selector?: string }) {
    const page = await getPage();
    console.error(`⌨️  Pressing: ${key}${selector ? ` em: ${selector}` : ""}`);

    const parts = key.split("+").map(p => p.trim());
    const actualKey = parts.pop() || key;
    const modifiers = parts;
    const isShortcut = modifiers.length > 0;

    if (isShortcut) {
      // Strategy 1: Playwright keyboard.press
      try {
        if (selector) {
          await page.locator(selector).first().press(key);
        } else {
          await page.keyboard.press(key);
        }
        console.error(`✅ Atalho pressionado (Playwright): ${key}`);
        await page.waitForTimeout(300);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, key, selector: selector || null, url: page.url() }) }],
        };
      } catch (err) {
        console.error(`⚠️  Playwright falhou: ${(err as Error).message.slice(0, 100)}`);
      }

      // Strategy 2: Dispatch KeyboardEvent on window AND document (Vue escuta window)
      const code = actualKey.length === 1
        ? (CHAR_TO_CODE[actualKey] || `Key${actualKey.toUpperCase()}`)
        : actualKey;

      for (const target of ["window", "document"]) {
        try {
          await page.evaluate(({ actualKey, code, modifiers }: { actualKey: string; code: string; modifiers: string[] }) => {
            const eventInit: KeyboardEventInit = {
              key: actualKey,
              code,
              ctrlKey: modifiers.some(m => /^ctrl|control$/i.test(m)),
              shiftKey: modifiers.some(m => /^shift$/i.test(m)),
              altKey: modifiers.some(m => /^alt$/i.test(m)),
              metaKey: modifiers.some(m => /^meta$/i.test(m)),
              bubbles: true,
              cancelable: true,
              composed: true,
            };
            const el = target === "window" ? window : document;
            el.dispatchEvent(new KeyboardEvent("keydown", eventInit));
            el.dispatchEvent(new KeyboardEvent("keypress", eventInit));
            el.dispatchEvent(new KeyboardEvent("keyup", eventInit));
          }, { actualKey, code, modifiers });
          console.error(`✅ Atalho via dispatchEvent no ${target}: ${key}`);
        } catch (err) {
          console.error(`⚠️  dispatchEvent no ${target} falhou: ${(err as Error).message.slice(0, 100)}`);
        }
      }

      await page.waitForTimeout(300);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, key, selector: selector || null, url: page.url() }) }],
      };
    }

    // Single key press
    if (selector) {
      try {
        await page.press(selector, key);
      } catch {
        await page.locator(selector).first().focus();
        await page.keyboard.press(key);
      }
    } else {
      await page.keyboard.press(key);
    }

    await page.waitForTimeout(200);
    console.error(`✅ Tecla pressionada: ${key}`);
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, key, selector: selector || null, url: page.url() }) }],
    };
  },
};

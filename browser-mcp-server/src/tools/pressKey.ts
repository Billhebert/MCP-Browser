import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

const KEY_NAMES = [
  "Enter", "Tab", "Escape", "Backspace", "Delete",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Home", "End", "PageUp", "PageDown",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
  "Space", "Shift", "Control", "Alt", "Meta",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

export const pressKeyTool: ToolDefinition = {
  name: "press_key",
  description:
    "Pressionar uma tecla no elemento ativo ou em um elemento específico. Útil para navegação por teclado, submissão de formulários (Enter), fechar modais (Escape), etc.",
  args: {
    key: z.enum(KEY_NAMES as [string, ...string[]]).describe("Tecla a pressionar (ex: 'Enter', 'Escape', 'Tab', 'ArrowDown')"),
    selector: z
      .string()
      .optional()
      .describe("Seletor CSS opcional. Se omitido, pressiona no elemento ativo."),
  },
  async execute({ key, selector }: { key: string; selector?: string }) {
    const page = await getPage();
    console.error(`⌨️  Pressionando: ${key}${selector ? ` em: ${selector}` : ""}`);

    if (selector) {
      await page.press(selector, key);
    } else {
      await page.keyboard.press(key);
    }

    await page.waitForTimeout(200);
    console.error(`✅ Tecla pressionada: ${key}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, key, selector: selector || null, url: page.url() }),
        },
      ],
    };
  },
};

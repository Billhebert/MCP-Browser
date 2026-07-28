import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const executeJsTool: ToolDefinition = {
  name: "execute_js",
  description: "Execute arbitrary JavaScript in the browser context.",
  args: {
    script: z.string().max(50000).describe("Code: JavaScript para executar na page"),
  },
  async execute({ script }: { script: string }) {
    console.error(`⚡ Executando JavaScript na página...`);
    const page = await getPage();
    const result = await page.evaluate(script);
    console.error(`✅ JavaScript executado`);
    return {
      content: [
        {
          type: "text",
          text:
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

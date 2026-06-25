import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const executeJsTool: ToolDefinition = {
  name: "execute_js",
  description: "Executar JavaScript arbitrário na página atual. Use com cuidado.",
  args: {
    script: z.string().describe("Código JavaScript para executar na página"),
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

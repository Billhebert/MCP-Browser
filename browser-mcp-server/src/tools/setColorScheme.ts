import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const setColorSchemeTool: ToolDefinition = {
  name: "set_color_scheme",
  description:
    "Forçar o esquema de cores do navegador: 'dark' (modo escuro) ou 'light' (modo claro). Afeta media query prefers-color-scheme.",
  args: {
    scheme: z.enum(["dark", "light"]).describe("Esquema de cores: 'dark' ou 'light'"),
  },
  async execute({ scheme }: { scheme: "dark" | "light" }) {
    const page = await getPage();
    console.error(`🎨 Alterando esquema de cores para: ${scheme}`);

    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(200);

    console.error(`✅ Esquema de cores alterado: ${scheme}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, colorScheme: scheme }),
        },
      ],
    };
  },
};

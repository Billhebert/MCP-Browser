import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getContext } from "../browser.js";

export const setLocaleTool: ToolDefinition = {
  name: "set_locale",
  description:
    "Alterar o idioma/localidade do navegador. Afeta Accept-Language e navigator.language. Ex: 'pt-BR', 'en-US', 'es', 'fr-FR'.",
  args: {
    locale: z.string().describe("Código do locale (ex: 'pt-BR', 'en-US', 'es', 'fr-FR')"),
  },
  async execute({ locale }: { locale: string }) {
    console.error(`🌍 Alterando locale para: ${locale}`);

    const ctx = await getContext();
    await ctx.setExtraHTTPHeaders({
      "Accept-Language": locale,
    });

    // Set locale via CDP
    const cdpSession = await ctx.newCDPSession(await ctx.newPage());
    await cdpSession.send("Emulation.setLocaleOverride", { locale });
    await cdpSession.detach();

    console.error(`✅ Locale alterado: ${locale}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, locale }),
        },
      ],
    };
  },
};

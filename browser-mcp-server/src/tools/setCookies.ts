import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const setCookiesTool: ToolDefinition = {
  name: "set_cookies",
  description:
    "Injetar cookies manualmente no navegador. Útil para autenticação ou testar estados específicos sem passar pelo fluxo de login.",
  args: {
    cookies: z
      .array(
        z.object({
          name: z.string().describe("Nome do cookie"),
          value: z.string().describe("Valor do cookie"),
          domain: z.string().optional().describe("Domínio (ex: '.exemplo.com')"),
          path: z.string().optional().describe("Path (padrão: '/')"),
          httpOnly: z.boolean().optional(),
          secure: z.boolean().optional(),
        }),
      )
      .describe("Lista de cookies para injetar"),
  },
  async execute({ cookies }: { cookies: Array<{ name: string; value: string; domain?: string; path?: string; httpOnly?: boolean; secure?: boolean }> }) {
    const page = await getPage();
    console.error(`🍪 Injetando ${cookies.length} cookies...`);

    const ctx = page.context();
    await ctx.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || new URL(page.url()).hostname,
        path: c.path || "/",
        httpOnly: c.httpOnly || false,
        secure: c.secure ?? (c.domain ? true : false),
      })),
    );

    console.error(`✅ ${cookies.length} cookies injetados`);
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    console.error(`✅ Página recarregada com novos cookies`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            count: cookies.length,
          }),
        },
      ],
    };
  },
};

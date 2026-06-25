import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const getCookiesTool: ToolDefinition = {
  name: "get_cookies",
  description: "Obter todos os cookies da página atual. Útil para verificar sessão e autenticação.",
  args: {
    name: z
      .string()
      .optional()
      .describe("Filtrar por nome do cookie"),
    domain: z
      .string()
      .optional()
      .describe("Filtrar por domínio"),
  },
  async execute({ name, domain }: { name?: string; domain?: string }) {
    const page = await getPage();
    console.error(`🍪 Obtendo cookies...`);

    const context = page.context();
    let cookies = await context.cookies();

    if (name) {
      cookies = cookies.filter((c) => c.name.includes(name!));
    }
    if (domain) {
      cookies = cookies.filter((c) => c.domain.includes(domain!));
    }

    if (cookies.length === 0) {
      return {
        content: [{ type: "text", text: "Nenhum cookie encontrado." }],
      };
    }

    const text = cookies
      .map(
        (c) =>
          `🍪 ${c.name} = ${c.value.slice(0, 50)}${c.value.length > 50 ? "..." : ""}
   Domínio: ${c.domain} | Path: ${c.path}
   HttpOnly: ${c.httpOnly} | Secure: ${c.secure} | SameSite: ${c.sameSite || "none"}
   Expira: ${c.expires ? new Date(c.expires * 1000).toISOString() : "sessão"}`,
      )
      .join("\n\n");

    return { content: [{ type: "text", text }] };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { setBlockedPatterns, getBlockedPatterns } from "../browser.js";

export const blockRequestsTool: ToolDefinition = {
  name: "block_requests",
  description:
    "Bloquear requisições de rede para domínios/URLs específicos. Útil para bloquear anúncios, analytics ou scripts lentos. Use clear=true para limpar todos os bloqueios.",
  args: {
    patterns: z
      .array(z.string())
      .optional()
      .describe(
        "Lista de padrões de URL para bloquear (ex: ['google-analytics.com', 'facebook.net'])",
      ),
    clear: z
      .boolean()
      .optional()
      .describe("Se true, limpa todos os bloqueios ativos"),
  },
  async execute({
    patterns,
    clear,
  }: {
    patterns?: string[];
    clear?: boolean;
  }) {
    console.error(`🚫 Gerenciando bloqueios de requisição...`);

    if (clear) {
      setBlockedPatterns([]);
      console.error(`✅ Bloqueios limpos`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              blockedPatterns: [],
              message: "Todos os bloqueios removidos",
            }),
          },
        ],
      };
    }

    if (patterns && patterns.length > 0) {
      setBlockedPatterns(patterns);
      console.error(`✅ Bloqueios ativos: ${patterns.join(", ")}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              blockedPatterns: patterns,
            }),
          },
        ],
      };
    }

    const current = getBlockedPatterns();
    return {
      content: [
        {
          type: "text",
          text:
            current.length > 0
              ? `Bloqueios ativos:\n${current.map((p) => `  🚫 ${p}`).join("\n")}`
              : "Nenhum bloqueio ativo no momento.",
        },
      ],
    };
  },
};

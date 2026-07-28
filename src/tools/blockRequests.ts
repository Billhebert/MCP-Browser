import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { setBlockedPatterns, getBlockedPatterns } from "../browser.js";

export const blockRequestsTool: ToolDefinition = {
  name: "block_requests",
  description: "Block network requests matching URL patterns.",
  args: {
    patterns: z
      .array(z.string().max(100))
      .optional()
      .describe(
        "Lista de padrões de URL para bloquear (ex: ['google-analytics.com', 'facebook.net'])",
      ),
    clear: z
      .boolean()
      .optional()
      .describe("If true, limpa todos os bloqueios ativos"),
  },
  async execute({
    patterns,
    clear,
  }: {
    patterns?: string[];
    clear?: boolean;
  }) {
    console.error(`🚫 Managing blocks de requisição...`);

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
      console.error(`✅ Active blocks: ${patterns.join(", ")}`);
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
              ? `Active blocks:\n${current.map((p) => `  🚫 ${p}`).join("\n")}`
              : "Nenhum bloqueio ativo no momento.",
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getConsoleLogs, clearConsoleLogs } from "../browser.js";

export const getConsoleTool: ToolDefinition = {
  name: "get_console",
  description:
    "Obter os logs do console do navegador (console.log, console.error, console.warn, etc). Útil para depurar erros de JavaScript na página.",
  args: {
    clear: z
      .boolean()
      .optional()
      .describe("Se true, limpa os logs após retornar"),
    type: z
      .enum(["error", "warning", "log", "pageerror"])
      .optional()
      .describe("Filtrar por tipo de log ('error', 'warning', 'log', 'pageerror')"),
  },
  async execute({ clear, type }: { clear?: boolean; type?: string }) {
    let logs = getConsoleLogs();
    console.error(`📋 Console logs disponíveis: ${logs.length}`);

    if (type) {
      logs = logs.filter((l) => l.type === type);
      console.error(`📋 Filtrados por '${type}': ${logs.length}`);
    }

    const recent = logs.slice(-100);

    if (clear) {
      clearConsoleLogs();
      console.error(`🧹 Console logs limpos`);
    }

    if (recent.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Nenhum log de console capturado.",
          },
        ],
      };
    }

    const text = recent
      .map((l) => `[${l.type}] ${l.text}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getConsoleLogs, clearConsoleLogs } from "../browser.js";

export const getConsoleTool: ToolDefinition = {
  name: "get_console",
  description: "Retrieve all captured console logs from the current page.",
  args: {
    clear: z
      .boolean()
      .optional()
      .describe("If true, limpa os logs após retornar"),
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

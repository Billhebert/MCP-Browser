import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getNetworkLogs, clearNetworkLogs } from "../browser.js";

export const getNetworkTool: ToolDefinition = {
  name: "get_network",
  description: "Get all captured network requests with status and timing.",
  args: {
    clear: z
      .boolean()
      .optional()
      .describe("If true, limpa o histórico após retornar"),
    status: z
      .number()
      .optional()
      .describe("Filter  por status HTTP (ex: 200, 404, 500)"),
    type: z
      .string().max(100)
      .optional()
      .describe("Filtrar por tipo (ex: 'xhr', 'fetch', 'document', 'script', 'image')"),
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
      .optional()
      .describe("Filter  por método HTTP"),
    url: z
      .string().max(5000)
      .optional()
      .describe("Filter  por default na URL"),
  },
  async execute(args: {
    clear?: boolean;
    status?: number;
    type?: string;
    method?: string;
    url?: string;
  }) {
    let logs = getNetworkLogs();
    console.error(`🌐 Requisições de rede capturadas: ${logs.length}`);

    if (args.status) {
      logs = logs.filter((l) => l.status === args.status);
    }
    if (args.type) {
      logs = logs.filter((l) => l.type === args.type);
    }
    if (args.method) {
      logs = logs.filter((l) => l.method === args.method);
    }
    if (args.url) {
      logs = logs.filter((l) => l.url.includes(args.url!));
    }

    if (args.clear) {
      clearNetworkLogs();
      console.error(`🧹 Logs de rede limpos`);
    }

    if (logs.length === 0) {
      return {
        content: [{ type: "text", text: "Nenhuma requisição de rede capturada com os filtros fornecidos." }],
      };
    }

    const recent = logs.slice(-100);
    const text =
      recent
        .map((l) => `[${l.status}] ${l.method} ${l.url} (${l.type})`)
        .join("\n") +
      `\n\n---\nTotal: ${logs.length} requisições`;

    return { content: [{ type: "text", text }] };
  },
};

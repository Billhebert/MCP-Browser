import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { addSchedule, listSchedules, removeSchedule, toggleSchedule } from "../corporate/collab.js";

export const scheduleAuditTool: ToolDefinition = {
  name: "schedule_audit",
  description: "Schedule a recurring audit using cron expression.",
  args: {
    action: z.string().max(100).describe("Ação: 'add', 'list', 'remove', 'toggle'"),
    tool: z.string().max(500).optional().describe("Name da tool para agendar (obrigatório para add)"),
    cron: z.string().max(500).optional().describe("Expressão cron simplificada: 'minuto hora', ex: '0 9' para 09:00, '30 14' para 14:30"),
    args: z.string().max(50000).optional().describe("JSON string with argumentos da tool (optional)"),
    id: z.string().max(500).optional().describe("ID do schedule (obrigatório para remove/toggle)"),
    enabled: z.string().max(5000).optional().describe("Ativar/desativar: 'true' ou 'false' (para toggle)"),
  },
  async execute(args: { action: string; tool?: string; cron?: string; args?: string; id?: string; enabled?: string }) {
    switch (args.action) {
      case "list": {
        const schedules = listSchedules();
        console.error(`📅 Schedules: ${schedules.length} active`);
        return { content: [{ type: "text", text: JSON.stringify({ schedules }, null, 2) }] };
      }
      case "add": {
        if (!args.tool || !args.cron) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "tool and cron required for add" }, null, 2) }] };
        }
        const toolArgs = args.args ? JSON.parse(args.args) as Record<string, unknown> : {};
        const id = addSchedule(args.cron, args.tool, toolArgs);
        console.error(`📅 Schedule added: ${id} — ${args.tool} at ${args.cron}`);
        return { content: [{ type: "text", text: JSON.stringify({ added: true, id, tool: args.tool, cron: args.cron }, null, 2) }] };
      }
      case "remove": {
        if (!args.id) return { content: [{ type: "text", text: JSON.stringify({ error: "id required for remove" }, null, 2) }] };
        const removed = removeSchedule(args.id);
        return { content: [{ type: "text", text: JSON.stringify({ removed }, null, 2) }] };
      }
      case "toggle": {
        if (!args.id || args.enabled === undefined) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "id and enabled required for toggle" }, null, 2) }] };
        }
        const toggled = toggleSchedule(args.id, args.enabled === "true");
        return { content: [{ type: "text", text: JSON.stringify({ toggled, enabled: args.enabled === "true" }, null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${args.action}. Use add, list, remove, toggle` }, null, 2) }] };
    }
  },
};

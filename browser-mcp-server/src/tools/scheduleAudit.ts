import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { addSchedule, listSchedules, removeSchedule, toggleSchedule } from "../corporate/collab.js";

export const scheduleAuditTool: ToolDefinition = {
  name: "schedule_audit",
  description:
    "Agendar auditorias recorrentes via cron simplificado. Suporta formato: 'minuto hora' (ex: '0 9' = 09:00, '* 8' = toda hora entre 8-9). Lista, adiciona, remove e ativa/desativa agendamentos. Schedules são verificados a cada 30s.",
  args: {
    action: z.string().describe("Ação: 'add', 'list', 'remove', 'toggle'"),
    tool: z.string().optional().describe("Nome da tool para agendar (obrigatório para add)"),
    cron: z.string().optional().describe("Expressão cron simplificada: 'minuto hora', ex: '0 9' para 09:00, '30 14' para 14:30"),
    args: z.string().optional().describe("JSON string com argumentos da tool (opcional)"),
    id: z.string().optional().describe("ID do schedule (obrigatório para remove/toggle)"),
    enabled: z.string().optional().describe("Ativar/desativar: 'true' ou 'false' (para toggle)"),
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

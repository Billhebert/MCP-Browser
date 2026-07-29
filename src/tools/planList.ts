import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { listPlans, deletePlan } from "../corporate/planner.js";

export const planListTool: ToolDefinition = {
  name: "plan_list",
  description: "Lista todos os planos de execução criados na sessão atual, com resumo de status, progresso e duração. Permite deletar planos antigos.",
  args: {
    action: z.string().max(20).optional().describe("'delete' para remover um plano (requer planId)"),
    planId: z.coerce.number().int().min(1).optional().describe("ID do plano para deletar (requer action: 'delete')"),
  },
  async execute(args: { action?: string; planId?: number }) {
    if (args.action === "delete") {
      if (!args.planId) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "planId é obrigatório para action: 'delete'" }) }], isError: true };
      }
      const deleted = deletePlan(args.planId);
      if (!deleted) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Plano ${args.planId} não encontrado` }) }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ status: "ok", message: `Plano ${args.planId} removido` }) }] };
    }

    const allPlans = listPlans();
    if (allPlans.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ plans: [], message: "Nenhum plano criado. Use plan_create primeiro." }) }] };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          total: allPlans.length,
          plans: allPlans.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            totalSteps: p.steps.length,
            completed: p.steps.filter((s) => s.status === "success").length,
            failed: p.steps.filter((s) => s.status === "failed").length,
            pending: p.steps.filter((s) => s.status === "pending").length,
            durationMs: p.steps.reduce((a, s) => a + (s.durationMs || 0), 0),
            createdAt: new Date(p.createdAt).toISOString(),
            tools: [...new Set(p.steps.map((s) => s.tool))],
          })),
        }, null, 2),
      }],
    };
  },
};

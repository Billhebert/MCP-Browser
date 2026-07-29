import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPlan, listPlans } from "../corporate/planner.js";

export const planStatusTool: ToolDefinition = {
  name: "plan_status",
  description: "Mostra o status detalhado de um plano: steps executados, pendentes, falhos, duração, e próximos steps prontos para executar.",
  args: {
    planId: z.coerce.number().int().min(1).optional().describe("ID do plano (se omitido, lista todos os planos)"),
  },
  async execute(args: { planId?: number }) {
    if (args.planId === undefined) {
      const allPlans = listPlans();
      if (allPlans.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ message: "Nenhum plano criado. Use plan_create primeiro." }) }] };
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalPlans: allPlans.length,
            plans: allPlans.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              steps: p.steps.length,
              completed: p.steps.filter((s) => s.status === "success").length,
              failed: p.steps.filter((s) => s.status === "failed").length,
              pending: p.steps.filter((s) => s.status === "pending").length,
              durationMs: p.steps.reduce((a, s) => a + (s.durationMs || 0), 0),
              createdAt: new Date(p.createdAt).toISOString(),
            })),
          }, null, 2),
        }],
      };
    }

    const plan = getPlan(args.planId);
    if (!plan) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Plano ${args.planId} não encontrado` }) }], isError: true };
    }

    const nextSteps = plan.steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status === "pending")
      .filter(({ s }) => s.dependsOn.every((d) => plan.steps[d]?.status === "success"))
      .map(({ i }) => i);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          id: plan.id,
          name: plan.name,
          status: plan.status,
          totalSteps: plan.steps.length,
          progress: {
            completed: plan.steps.filter((s) => s.status === "success").length,
            failed: plan.steps.filter((s) => s.status === "failed").length,
            skipped: plan.steps.filter((s) => s.status === "skipped").length,
            pending: plan.steps.filter((s) => s.status === "pending").length,
          },
          totalDurationMs: plan.steps.reduce((a, s) => a + (s.durationMs || 0), 0),
          currentStep: plan.currentStep,
          nextSteps,
          steps: plan.steps.map((s) => ({
            id: s.id,
            tool: s.tool,
            status: s.status,
            dependsOn: s.dependsOn,
            onFail: s.onFail,
            durationMs: s.durationMs || null,
            error: s.error || null,
            resultPreview: s.result?.slice(0, 100) || null,
          })),
        }, null, 2),
      }],
    };
  },
};

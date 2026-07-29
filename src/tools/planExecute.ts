import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPlan, executeStep, executeAllSteps } from "../corporate/planner.js";

export const planExecuteTool: ToolDefinition = {
  name: "plan_execute",
  description: "Executa o próximo step pendente de um plano (ou todos os steps de uma vez). Respeita dependências entre steps. Se um step falhar, executa a ação configurada (continue/abort/skip).",
  args: {
    planId: z.coerce.number().int().min(1).describe("ID do plano (retornado por plan_create)"),
    mode: z.string().max(20).optional().describe("'step' executa 1 step por vez (padrão), 'all' executa todos os steps em sequência"),
    stepId: z.coerce.number().int().min(0).optional().describe("Step específico para executar (opcional, padrão: próximo pendente)"),
  },
  async execute(args: { planId: number; mode?: string; stepId?: number }) {
    const plan = getPlan(args.planId);
    if (!plan) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Plano ${args.planId} não encontrado. Use plan_list para ver planos disponíveis.` }) }], isError: true };
    }

    if (args.mode === "all") {
      const result = await executeAllSteps(args.planId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            planId: args.planId,
            planName: plan.name,
            action: "executar todos",
            ...result,
            steps: plan.steps.map((s) => ({
              id: s.id,
              tool: s.tool,
              status: s.status,
              durationMs: s.durationMs || null,
              error: s.error || null,
            })),
          }, null, 2),
        }],
      };
    }

    const result = await executeStep(args.planId, args.stepId);
    const step = plan.steps[result.stepId];

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          planId: args.planId,
          planName: plan.name,
          planStatus: result.newPlanStatus,
          step: step ? { id: step.id, tool: step.tool, status: step.status } : null,
          result: {
            stepId: result.stepId,
            status: result.status,
            durationMs: result.durationMs,
            error: result.error || null,
            resultPreview: result.result?.slice(0, 300) || null,
          },
          nextSteps: result.nextSteps,
          progress: `${plan.steps.filter((s) => s.status === "success").length}/${plan.steps.length} steps concluídos`,
        }, null, 2),
      }],
    };
  },
};

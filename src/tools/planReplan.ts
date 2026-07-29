import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPlan, addStepsToPlan, removeStepsFromPlan, reorderSteps } from "../corporate/planner.js";

export const planReplanTool: ToolDefinition = {
  name: "plan_replan",
  description: "Modifica um plano existente: adiciona novos steps, remove steps pendentes, ou reordena steps. Útil para ajustar o plano baseado em resultados parciais.",
  args: {
    planId: z.coerce.number().int().min(1).describe("ID do plano a modificar"),
    action: z.string().max(20).describe("'add' para adicionar steps, 'remove' para remover, 'reorder' para reordenar"),
    steps: z.string().max(100000).optional().describe("JSON array de steps (para add)"),
    stepIds: z.string().max(5000).optional().describe("JSON array de IDs de steps (para remove)"),
    newOrder: z.string().max(5000).optional().describe("JSON array com a nova ordem dos IDs (para reorder)"),
  },
  async execute(args: { planId: number; action: string; steps?: string; stepIds?: string; newOrder?: string }) {
    const plan = getPlan(args.planId);
    if (!plan) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Plano ${args.planId} não encontrado` }) }], isError: true };
    }

    if (args.action === "add") {
      if (!args.steps) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "'steps' é obrigatório para action: 'add'" }) }], isError: true };
      }
      let newSteps: Array<{ tool: string; args?: Record<string, unknown>; dependsOn?: number[]; onFail?: "continue" | "abort" | "skip" }>;
      try { newSteps = JSON.parse(args.steps); } catch {
        return { content: [{ type: "text", text: JSON.stringify({ error: "JSON inválido em 'steps'" }) }], isError: true };
      }
      const updated = addStepsToPlan(args.planId, newSteps);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            action: "add",
            planId: args.planId,
            addedCount: newSteps.length,
            totalSteps: updated.steps.length,
            steps: updated.steps.map((s) => ({
              id: s.id,
              tool: s.tool,
              status: s.status,
              dependsOn: s.dependsOn,
            })),
          }, null, 2),
        }],
      };
    }

    if (args.action === "remove") {
      if (!args.stepIds) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "'stepIds' é obrigatório para action: 'remove'" }) }], isError: true };
      }
      let ids: number[];
      try { ids = JSON.parse(args.stepIds); } catch {
        return { content: [{ type: "text", text: JSON.stringify({ error: "JSON inválido em 'stepIds'" }) }], isError: true };
      }
      const updated = removeStepsFromPlan(args.planId, ids);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            action: "remove",
            planId: args.planId,
            removedCount: ids.length,
            totalSteps: updated.steps.length,
            steps: updated.steps.map((s) => ({ id: s.id, tool: s.tool, status: s.status })),
          }, null, 2),
        }],
      };
    }

    if (args.action === "reorder") {
      if (!args.newOrder) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "'newOrder' é obrigatório para action: 'reorder'" }) }], isError: true };
      }
      let order: number[];
      try { order = JSON.parse(args.newOrder); } catch {
        return { content: [{ type: "text", text: JSON.stringify({ error: "JSON inválido em 'newOrder'" }) }], isError: true };
      }
      const updated = reorderSteps(args.planId, order);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            action: "reorder",
            planId: args.planId,
            totalSteps: updated.steps.length,
            steps: updated.steps.map((s) => ({ id: s.id, tool: s.tool, status: s.status })),
          }, null, 2),
        }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ error: "action deve ser 'add', 'remove', ou 'reorder'" }) }], isError: true,
    };
  },
};

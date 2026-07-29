import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { createPlan } from "../corporate/planner.js";

export const planCreateTool: ToolDefinition = {
  name: "plan_create",
  description: "Cria um plano de execução com múltiplos steps. Cada step é uma ferramenta MCP que será executada em sequência, respeitando dependências. Útil para automatizar fluxos complexos.",
  args: {
    name: z.string().max(200).describe("Nome do plano (ex: 'Auditoria completa do site')"),
    steps: z.string().max(100000).describe("JSON array de steps. Cada step: { tool: string, args?: object, dependsOn?: number[], onFail?: 'continue'|'abort'|'skip' }"),
    onStepFail: z.string().max(20).optional().describe("Ação padrão quando um step falha: 'continue' (padrão), 'abort', 'skip'"),
  },
  async execute(args: { name: string; steps: string; onStepFail?: string }) {
    let steps: Array<{ tool: string; args?: Record<string, unknown>; dependsOn?: number[]; onFail?: "continue" | "abort" | "skip" }>;
    try { steps = JSON.parse(args.steps); } catch {
      return { content: [{ type: "text", text: JSON.stringify({ error: "JSON inválido em 'steps'. Envie um array de objetos." }) }], isError: true };
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "'steps' deve ser um array não vazio" }) }], isError: true };
    }

    for (const s of steps) {
      if (!s.tool) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Cada step deve ter um campo 'tool'" }) }], isError: true };
      }
    }

    const onFail = (args.onStepFail || "continue") as "continue" | "abort" | "skip";
    const plan = createPlan(args.name, steps, onFail);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          planId: plan.id,
          name: plan.name,
          totalSteps: plan.steps.length,
          status: plan.status,
          steps: plan.steps.map((s) => ({
            id: s.id,
            tool: s.tool,
            hasArgs: Object.keys(s.args).length > 0,
            dependsOn: s.dependsOn,
            onFail: s.onFail,
          })),
        }, null, 2),
      }],
    };
  },
};

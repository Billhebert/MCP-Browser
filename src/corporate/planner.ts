export type StepStatus = "pending" | "running" | "success" | "failed" | "skipped" | "aborted";
export type OnFailAction = "continue" | "abort" | "skip";

export interface PlanStep {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  dependsOn: number[];
  onFail: OnFailAction;
  status: StepStatus;
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface Plan {
  id: number;
  name: string;
  createdAt: number;
  steps: PlanStep[];
  status: "active" | "completed" | "failed" | "aborted";
  currentStep: number;
  onStepFail: OnFailAction;
}

let nextId = 1;
const plans = new Map<number, Plan>();

export function createPlan(name: string, steps: Array<{
  id?: number;
  tool: string;
  args?: Record<string, unknown>;
  dependsOn?: number[];
  onFail?: OnFailAction;
}>, defaultOnFail: OnFailAction = "continue"): Plan {
  const id = nextId++;
  const planSteps: PlanStep[] = steps.map((s, i) => ({
    id: i,
    tool: s.tool,
    args: s.args || {},
    dependsOn: s.dependsOn || [],
    onFail: s.onFail || defaultOnFail,
    status: "pending",
  }));

  const plan: Plan = {
    id,
    name,
    createdAt: Date.now(),
    steps: planSteps,
    status: "active",
    currentStep: 0,
    onStepFail: defaultOnFail,
  };

  plans.set(id, plan);
  return plan;
}

export function getPlan(id: number): Plan | undefined {
  return plans.get(id);
}

export function listPlans(): Plan[] {
  return Array.from(plans.values());
}

export function deletePlan(id: number): boolean {
  return plans.delete(id);
}

function canRun(step: PlanStep, plan: Plan): boolean {
  if (step.status !== "pending") return false;
  for (const depId of step.dependsOn) {
    const dep = plan.steps[depId];
    if (!dep || dep.status !== "success") return false;
  }
  return true;
}

export interface ExecuteResult {
  planId: number;
  stepId: number;
  status: StepStatus;
  result?: any;
  error?: string;
  durationMs: number;
  newPlanStatus: string;
  nextSteps: number[];
}

export async function executeStep(planId: number, stepId?: number): Promise<ExecuteResult> {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plano ${planId} não encontrado`);
  if (plan.status !== "active") throw new Error(`Plano ${planId} está ${plan.status}`);

  // Find next ready step if no specific step
  const targetId = stepId ?? plan.steps.findIndex((s) => canRun(s, plan));
  if (targetId === -1) {
    const remaining = plan.steps.filter((s) => s.status === "pending" || s.status === "running");
    if (remaining.length === 0) {
      plan.status = "completed";
      return {
        planId, stepId: -1, status: "success", durationMs: 0,
        newPlanStatus: "completed", nextSteps: [],
      };
    }
    // Check if any step is blocked by failed dependencies
    const blocked = remaining.filter((s) =>
      s.dependsOn.some((d) => plan.steps[d]?.status === "failed")
    );
    for (const b of blocked) {
      b.status = "skipped";
    }
    if (plan.steps.every((s) => s.status === "success" || s.status === "skipped")) {
      plan.status = "completed";
      return {
        planId, stepId: -1, status: "success", durationMs: 0,
        newPlanStatus: "completed", nextSteps: [],
      };
    }
    throw new Error("Nenhum step pronto para executar. Verifique dependências.");
  }

  const step = plan.steps[targetId];
  if (!step) throw new Error(`Step ${targetId} não encontrado`);
  if (step.status !== "pending") throw new Error(`Step ${targetId} já está ${step.status}`);

  // Check dependencies
  for (const depId of step.dependsOn) {
    const dep = plan.steps[depId];
    if (!dep || dep.status !== "success") {
      throw new Error(`Step ${targetId} depende do step ${depId} que ainda não foi concluído`);
    }
  }

  // Execute
  step.status = "running";
  step.startedAt = Date.now();
  plan.currentStep = targetId;

  try {
    const { toolMap } = await import("../tools/registry.js");
    const tool = toolMap.get(step.tool);
    if (!tool) throw new Error(`Ferramenta "${step.tool}" não encontrada`);

    const result = await tool.execute(step.args);
    const isError = result.isError === true;

    step.result = result.content?.[0]?.text || "";
    step.completedAt = Date.now();
    step.durationMs = step.completedAt - step.startedAt;

    if (isError) {
      step.status = "failed";
      step.error = result.content?.[0]?.text?.slice(0, 200) || "Erro desconhecido";

      if (step.onFail === "abort") {
        plan.status = "aborted";
      } else if (step.onFail === "skip") {
        step.status = "skipped";
      }
    } else {
      step.status = "success";
    }

    // Check if all done
    const allDone = plan.steps.every((s) => s.status === "success" || s.status === "skipped");
    if (allDone) plan.status = "completed";

    // Find next ready steps
    const nextSteps = plan.steps
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => canRun(s, plan))
      .map(({ i }) => i);

    return {
      planId,
      stepId: targetId,
      status: step.status,
      result: step.result,
      error: step.error,
      durationMs: step.durationMs || 0,
      newPlanStatus: plan.status,
      nextSteps,
    };
  } catch (err: any) {
    step.status = "failed";
    step.error = err.message;
    step.completedAt = Date.now();
    step.durationMs = step.completedAt - step.startedAt;

    if (step.onFail === "abort") plan.status = "aborted";
    if (step.onFail === "skip") step.status = "skipped";

    return {
      planId,
      stepId: targetId,
      status: step.status,
      error: err.message,
      durationMs: step.durationMs || 0,
      newPlanStatus: plan.status,
      nextSteps: [],
    };
  }
}

export async function executeAllSteps(planId: number, concurrency = 1): Promise<{
  totalSteps: number;
  completed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  planStatus: string;
}> {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plano ${planId} não encontrado`);

  const startTime = Date.now();
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  while (plan.status === "active") {
    const nextIdx = plan.steps.findIndex((s) => canRun(s, plan));
    if (nextIdx === -1) break;

    const result = await executeStep(planId, nextIdx);
    if (result.status === "success") completed++;
    else if (result.status === "failed") failed++;
    else if (result.status === "skipped") skipped++;

    if (result.newPlanStatus === "aborted") break;
  }

  // Skip remaining blocked steps
  for (const step of plan.steps) {
    if (step.status === "pending") step.status = "skipped";
  }

  if (plan.status === "active") plan.status = "completed";

  return {
    totalSteps: plan.steps.length,
    completed,
    failed,
    skipped: plan.steps.filter((s) => s.status === "skipped").length,
    durationMs: Date.now() - startTime,
    planStatus: plan.status,
  };
}

export function addStepsToPlan(planId: number, newSteps: Array<{
  tool: string;
  args?: Record<string, unknown>;
  dependsOn?: number[];
  onFail?: OnFailAction;
}>, defaultOnFail?: OnFailAction): Plan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plano ${planId} não encontrado`);
  if (plan.status !== "active") throw new Error(`Plano ${planId} está ${plan.status}`);

  for (const s of newSteps) {
    const newId = plan.steps.length;
    const dependsOn = s.dependsOn || [];
    // Validar dependências
    for (const d of dependsOn) {
      if (d >= plan.steps.length) throw new Error(`Dependência ${d} não existe no plano`);
    }
    plan.steps.push({
      id: newId,
      tool: s.tool,
      args: s.args || {},
      dependsOn,
      onFail: s.onFail || defaultOnFail || plan.onStepFail,
      status: "pending",
    });
  }
  return plan;
}

export function removeStepsFromPlan(planId: number, stepIds: number[]): Plan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plano ${planId} não encontrado`);

  for (const sid of stepIds) {
    const step = plan.steps[sid];
    if (!step) continue;
    if (step.status !== "pending") throw new Error(`Step ${sid} já foi executado (${step.status})`);
  }

  plan.steps = plan.steps.filter((_, i) => !stepIds.includes(i));
  // Re-index IDs
  plan.steps.forEach((s, i) => { s.id = i; s.dependsOn = s.dependsOn.filter((d) => !stepIds.includes(d)); });

  return plan;
}

export function reorderSteps(planId: number, newOrder: number[]): Plan {
  const plan = plans.get(planId);
  if (!plan) throw new Error(`Plano ${planId} não encontrado`);

  if (newOrder.length !== plan.steps.length) throw new Error("newOrder deve ter o mesmo número de steps");
  const allIds = new Set(newOrder);
  for (const s of plan.steps) { if (!allIds.has(s.id)) throw new Error(`ID ${s.id} não está em newOrder`); }

  // Only reorder pending steps
  const done = plan.steps.filter((s) => s.status !== "pending");
  const pending = plan.steps.filter((s) => s.status === "pending");
  const pendingIds = new Set(pending.map((s) => s.id));
  const newPending = newOrder.filter((id) => pendingIds.has(id)).map((id) => plan.steps[id]);

  plan.steps = [...done, ...newPending];
  plan.steps.forEach((s, i) => s.id = i);

  return plan;
}

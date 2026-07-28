import type { IToolExecutorService, ExecuteOptions, ExecuteResult } from "../contracts/services.js";
import type { ToolDefinition } from "../types.js";
import { toolMap } from "../tools/registry.js";
import { serialized } from "../browser.js";
import { NotFoundError } from "../contracts/errors.js";
import { Pipeline, type ExecutionContext } from "../pipeline.js";
import { eventBus } from "../eventBus.js";
import { getConfig } from "../config.js";
import { AuthMiddleware } from "../middleware/authMiddleware.js";
import { RateLimitMiddleware } from "../middleware/rateLimitMiddleware.js";
import { AuditMiddleware } from "../middleware/auditMiddleware.js";
import { WebhookMiddleware } from "../middleware/webhookMiddleware.js";
import { MetricsMiddleware } from "../middleware/metricsMiddleware.js";

export class ToolExecutorService implements IToolExecutorService {
  private pipeline: Pipeline;

  constructor() {
    this.pipeline = new Pipeline([
      new MetricsMiddleware(),
      new AuthMiddleware(),
      new RateLimitMiddleware(),
      new AuditMiddleware(),
      new WebhookMiddleware(),
    ]);
  }

  getPipeline(): Pipeline {
    return this.pipeline;
  }

  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const { toolName, args, user, sessionId = "default" } = options;
    const startTime = Date.now();

    const tool = toolMap.get(toolName);
    if (!tool) throw new NotFoundError("Tool", toolName);

    const parsedArgs = this.parseArgs(tool, args);

    const ctx: ExecutionContext = {
      toolName,
      args,
      parsedArgs,
      user,
      sessionId,
      startTime,
      metadata: {},
    };

    eventBus.emit("tool:before", { toolName, user });

    try {
      const result = await this.pipeline.execute(ctx, () => serialized(() => tool.execute(parsedArgs)));

      eventBus.emit("tool:success", { toolName, user, duration: Date.now() - startTime });

      const duration = Date.now() - startTime;
      return {
        result: { ...result, duration } as any,
        auditEntry: { timestamp: new Date().toISOString(), tool: toolName, user, session: sessionId, args, result: { status: "pass" }, durationMs: duration },
      };
    } catch (err) {
      eventBus.emit("tool:error", { toolName, user, error: (err as Error).message });
      throw err;
    }
  }

  private parseArgs(tool: ToolDefinition, args: Record<string, unknown>): Record<string, unknown> {
    const parsed: Record<string, unknown> = {};
    for (const [key, zodType] of Object.entries(tool.args)) {
      if (key in args) parsed[key] = zodType.parse(args[key]);
    }
    return parsed;
  }
}

export function createToolResult(content: string | object, isError = false): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return { content: [{ type: "text", text }], isError: isError ? true : undefined };
}

export function createErrorResult(error: Error): { content: Array<{ type: string; text: string }>; isError: boolean } {
  return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
}

import type { Middleware, ExecutionContext } from "../pipeline.js";
import type { AuditEntry } from "../contracts/repositories.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { eventBus } from "../eventBus.js";

export class AuditMiddleware implements Middleware {
  name = "audit";
  private repo = new AuditRepository();

  async after(ctx: ExecutionContext): Promise<void> {
    const resText = ctx.result?.content?.[0]?.text || "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(resText); } catch {}

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      tool: ctx.toolName,
      user: ctx.user,
      session: ctx.sessionId,
      args: ctx.args,
      result: {
        status: ctx.error ? "fail" : "pass",
        score: parsed.score as number | undefined,
        issueCount: Array.isArray(parsed.issues) ? parsed.issues.length : undefined,
      },
      durationMs: Date.now() - ctx.startTime,
    };

    this.repo.write(entry);
    eventBus.emit("audit:saved", entry as any);
  }

  async onError(ctx: ExecutionContext): Promise<void> {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      tool: ctx.toolName,
      user: ctx.user,
      session: ctx.sessionId,
      args: ctx.args,
      result: { status: "fail" },
      durationMs: Date.now() - ctx.startTime,
    };

    this.repo.write(entry);
    eventBus.emit("audit:saved", entry as any);
  }
}

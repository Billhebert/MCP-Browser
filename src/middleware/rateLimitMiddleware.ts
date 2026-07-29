import type { Middleware, ExecutionContext } from "../pipeline.js";
import { checkRateLimit } from "../corporate/rateLimiter.js";
import { RateLimitError } from "../contracts/errors.js";
import { eventBus } from "../eventBus.js";

export class RateLimitMiddleware implements Middleware {
  name = "rateLimit";

  async before(ctx: ExecutionContext): Promise<void> {
    const rlKey = `${ctx.user}:${ctx.toolName}`;
    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      eventBus.emit("rateLimit:exceeded", { toolName: ctx.toolName, user: ctx.user, resetInMs: rl.resetInMs });
      throw new RateLimitError(rl.resetInMs);
    }
  }
}

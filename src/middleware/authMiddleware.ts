import type { Middleware, ExecutionContext } from "../pipeline.js";
import { validateApiKey } from "../corporate/auth.js";
import { AuthError } from "../contracts/errors.js";
import { eventBus } from "../eventBus.js";

export class AuthMiddleware implements Middleware {
  name = "auth";

  async before(ctx: ExecutionContext): Promise<void> {
    const apiKey = ctx.metadata?.apiKey as string | undefined;
    const auth = validateApiKey(apiKey);
    if (!auth.valid) {
      eventBus.emit("auth:failed", { toolName: ctx.toolName });
      throw new AuthError();
    }
    ctx.user = auth.user;
  }
}

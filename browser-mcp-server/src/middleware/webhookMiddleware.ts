import type { Middleware, ExecutionContext } from "../pipeline.js";
import { sendWebhook } from "../corporate/webhook.js";
import { eventBus } from "../eventBus.js";

export class WebhookMiddleware implements Middleware {
  name = "webhook";

  async after(ctx: ExecutionContext): Promise<void> {
    if (ctx.result?.isError) {
      const resText = ctx.result?.content?.[0]?.text || "";
      const maskedError = resText.replace(/(["']?(?:password|secret|token|api[_-]?key|authorization|auth)["']?\s*[:=]\s*["']?)[^"'\s,;}\]]+/gi, "$1***");
      sendWebhook("error", { tool: ctx.toolName, error: maskedError.slice(0, 200) });
      eventBus.emit("webhook:sent", { tool: ctx.toolName, event: "error" });
    }
  }
}

import type { Middleware, ExecutionContext } from "../pipeline.js";
import { incRequestCount, incErrorCount } from "../corporate/health.js";
import { eventBus } from "../eventBus.js";

export class MetricsMiddleware implements Middleware {
  name = "metrics";

  async before(): Promise<void> {
    incRequestCount();
  }

  async onError(): Promise<void> {
    incErrorCount();
    eventBus.emit("metrics:error", {});
  }
}

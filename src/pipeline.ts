export interface ExecutionContext {
  toolName: string;
  args: Record<string, unknown>;
  parsedArgs: Record<string, unknown>;
  user: string;
  sessionId: string;
  startTime: number;
  result?: any;
  error?: Error;
  metadata: Record<string, unknown>;
}

export interface Middleware {
  name: string;
  before?: (ctx: ExecutionContext) => Promise<void>;
  after?: (ctx: ExecutionContext) => Promise<void>;
  onError?: (ctx: ExecutionContext, error: Error) => Promise<void>;
}

export class Pipeline {
  private middlewares: Middleware[];

  constructor(middlewares: Middleware[] = []) {
    this.middlewares = middlewares;
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  remove(name: string): void {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
  }

  async execute(ctx: ExecutionContext, handler: () => Promise<any>): Promise<any> {
    try {
      for (const m of this.middlewares) {
        if (m.before) await m.before(ctx);
      }

      ctx.result = await handler();

      for (const m of [...this.middlewares].reverse()) {
        if (m.after) await m.after(ctx);
      }

      return ctx.result;
    } catch (err) {
      ctx.error = err as Error;
      for (const m of [...this.middlewares].reverse()) {
        if (m.onError) await m.onError(ctx, err as Error);
      }
      throw err;
    }
  }
}

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

interface Bindings {
  [key: string]: unknown;
}

function log(level: Level, bindings: Bindings, msg: string, extra?: Record<string, unknown>) {
  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    msg,
    ...bindings,
    ...extra,
  };
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(JSON.stringify(entry) + "\n");
}

export function createLogger(bindings: Bindings = {}) {
  return {
    info: (msg: string, extra?: Record<string, unknown>) => log("info", bindings, msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => log("warn", bindings, msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => log("error", bindings, msg, extra),
    debug: (msg: string, extra?: Record<string, unknown>) => log("debug", bindings, msg, extra),
    child: (extra: Bindings) => createLogger({ ...bindings, ...extra }),
    flush: async () => {},
  };
}

export type Logger = ReturnType<typeof createLogger>;

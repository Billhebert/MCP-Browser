type L = "error" | "warn" | "info";
function log(l: L, b: Record<string, unknown>, m: string, e?: Record<string, unknown>) {
  (l === "error" ? process.stderr : process.stdout).write(JSON.stringify({ level: l, time: new Date().toISOString(), msg: m, ...b, ...e }) + "\n");
}
export function createLogger(b: Record<string, unknown> = {}) {
  return { info: (m: string, e?: Record<string, unknown>) => log("info", b, m, e), warn: (m: string, e?: Record<string, unknown>) => log("warn", b, m, e), error: (m: string, e?: Record<string, unknown>) => log("error", b, m, e), child: (x: Record<string, unknown>) => createLogger({ ...b, ...x }) };
}

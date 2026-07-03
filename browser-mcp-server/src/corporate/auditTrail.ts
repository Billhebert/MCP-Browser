import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const AUDIT_DIR = process.env.BVP_AUDIT_DIR || path.join(os.homedir(), ".bvp-audit");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

let initialized = false;

function getAuditPath(): string {
  return path.join(AUDIT_DIR, "audit.jsonl");
}

function rotateIfNeeded(): void {
  const auditPath = getAuditPath();
  if (fs.existsSync(auditPath) && fs.statSync(auditPath).size >= MAX_FILE_SIZE) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(auditPath, path.join(AUDIT_DIR, `audit-${timestamp}.jsonl`));

    // Cleanup old files
    const files = fs.readdirSync(AUDIT_DIR)
      .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
      .sort()
      .reverse();
    for (const old of files.slice(MAX_FILES - 1)) {
      try { fs.unlinkSync(path.join(AUDIT_DIR, old)); } catch {}
    }
  }
}

function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
  rotateIfNeeded();
}

export function writeAudit(entry: Record<string, unknown>): void {
  ensureInit();
  const auditPath = getAuditPath();
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(auditPath, line);
  rotateIfNeeded();
}

export function readAudits(limit = 50, filter?: Record<string, unknown>): Record<string, unknown>[] {
  ensureInit();
  const auditPath = getAuditPath();
  if (!fs.existsSync(auditPath)) return [];
  const content = fs.readFileSync(auditPath, "utf-8").trim();
  if (!content) return [];
  let entries = content.split("\n").reverse().slice(0, limit).map((l) => JSON.parse(l));
  if (filter) {
    entries = entries.filter((e) =>
      Object.entries(filter).every(([k, v]) => {
        // Check top-level key
        if (e[k] === v) return true;
        // Check nested result key
        const r = e.result as Record<string, unknown> | undefined;
        if (r && r[k] === v) return true;
        return false;
      })
    );
  }
  return entries;
}

export function getAuditStats(): {
  totalExecutions: number;
  totalErrors: number;
  averageScore: number;
  topTools: Array<{ tool: string; count: number }>;
  uptimeDays: number;
} {
  ensureInit();
  const auditPath = getAuditPath();
  if (!fs.existsSync(auditPath)) {
    return { totalExecutions: 0, totalErrors: 0, averageScore: 0, topTools: [], uptimeDays: 0 };
  }
  const content = fs.readFileSync(auditPath, "utf-8").trim();
  if (!content) {
    return { totalExecutions: 0, totalErrors: 0, averageScore: 0, topTools: [], uptimeDays: 0 };
  }
  const entries: Record<string, unknown>[] = content.split("\n").map((l) => JSON.parse(l));
  const errors = entries.filter((e) => {
    const r = e.result as Record<string, unknown> | undefined;
    return r?.status === "fail" || r?.error;
  });
  const withScore = entries.filter((e) => {
    const r = e.result as Record<string, unknown> | undefined;
    return r?.score !== undefined;
  });
  const avgScore = withScore.length > 0
    ? Math.round(withScore.reduce((s, e) => {
        const r = e.result as Record<string, unknown>;
        return s + (r.score as number || 0);
      }, 0) / withScore.length)
    : 0;
  const toolCounts: Record<string, number> = {};
  for (const e of entries) {
    const tool = e.tool as string;
    toolCounts[tool] = (toolCounts[tool] || 0) + 1;
  }
  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, count }));
  const firstEntry = entries[0];
  const uptimeDays = firstEntry
    ? Math.round((Date.now() - new Date(firstEntry.timestamp as string).getTime()) / 86400000)
    : 0;
  return { totalExecutions: entries.length, totalErrors: errors.length, averageScore: avgScore, topTools, uptimeDays };
}

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const AUDIT_DIR = process.env.BVP_AUDIT_DIR || path.join(os.homedir(), ".bvp-audit");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const FLUSH_INTERVAL = 2000;

let initialized = false;
let writeQueue: string[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function getAuditPath(): string {
  return path.join(AUDIT_DIR, "audit.jsonl");
}

async function ensureInit(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try { await fsp.mkdir(AUDIT_DIR, { recursive: true }); } catch {}
  await rotateIfNeeded();
  if (!flushTimer) {
    flushTimer = setInterval(flushQueue, FLUSH_INTERVAL);
  }
}

async function rotateIfNeeded(): Promise<void> {
  const auditPath = getAuditPath();
  try {
    const stat = await fsp.stat(auditPath).catch(() => null);
    if (stat && stat.size >= MAX_FILE_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      await fsp.rename(auditPath, path.join(AUDIT_DIR, `audit-${timestamp}.jsonl`)).catch(() => {});
      const files = (await fsp.readdir(AUDIT_DIR).catch(() => []))
        .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
        .sort()
        .reverse();
      for (const old of files.slice(MAX_FILES - 1)) {
        await fsp.unlink(path.join(AUDIT_DIR, old)).catch(() => {});
      }
    }
  } catch {}
}

async function flushQueue(): Promise<void> {
  if (writeQueue.length === 0) return;
  const lines = writeQueue.join("");
  writeQueue = [];
  try {
    await fsp.appendFile(getAuditPath(), lines);
  } catch (err) {
    console.error("[Audit] Write failed:", (err as Error).message);
  }
}

export function writeAudit(entry: Record<string, unknown>): void {
  ensureInit().catch(() => {});
  writeQueue.push(JSON.stringify(entry) + "\n");
  if (writeQueue.length >= 20) flushQueue().catch(() => {});
}

export async function readAudits(limit = 50, filter?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  await flushQueue();
  await ensureInit();
  const auditPath = getAuditPath();
  try {
    const content = await fsp.readFile(auditPath, "utf-8").catch(() => "");
    if (!content.trim()) return [];
    let entries = content.trim().split("\n").reverse().slice(0, limit).map((l) => JSON.parse(l));
    if (filter) {
      entries = entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => {
          if (e[k] === v) return true;
          const r = e.result as Record<string, unknown> | undefined;
          if (r && r[k] === v) return true;
          return false;
        })
      );
    }
    return entries;
  } catch { return []; }
}

export async function getAuditStats(): Promise<{
  totalExecutions: number;
  totalErrors: number;
  averageScore: number;
  topTools: Array<{ tool: string; count: number }>;
  uptimeDays: number;
}> {
  await flushQueue();
  await ensureInit();
  const auditPath = getAuditPath();
  try {
    const content = await fsp.readFile(auditPath, "utf-8").catch(() => "");
    if (!content.trim()) return { totalExecutions: 0, totalErrors: 0, averageScore: 0, topTools: [], uptimeDays: 0 };
    const entries: Record<string, unknown>[] = content.trim().split("\n").map((l) => JSON.parse(l));
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
  } catch { return { totalExecutions: 0, totalErrors: 0, averageScore: 0, topTools: [], uptimeDays: 0 }; }
}

export function cleanup(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  flushQueue().catch(() => {});
}

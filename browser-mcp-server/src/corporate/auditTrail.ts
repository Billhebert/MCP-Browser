import fs from "fs";
import path from "path";
import os from "os";

const LOG_DIR = process.env.BVP_AUDIT_DIR || path.join(os.homedir(), ".bvp-audit");
const LOG_FILE = path.join(LOG_DIR, "audit.jsonl");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export interface AuditEntry {
  timestamp: string;
  tool: string;
  user: string;
  session: string;
  args: Record<string, unknown>;
  result: { status: string; score?: number; issueCount?: number; error?: string };
  durationMs: number;
}

export function writeAudit(entry: AuditEntry): void {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error(`[Audit] Failed to write: ${(e as Error).message}`);
  }
}

export function readAudits(limit = 100, filter?: { tool?: string; session?: string; status?: string }): AuditEntry[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const lines = fs.readFileSync(LOG_FILE, "utf-8").trim().split("\n").filter(Boolean);
    const entries: AuditEntry[] = lines.slice(-limit).map((l) => JSON.parse(l));
    return entries.filter((e) => {
      if (filter?.tool && e.tool !== filter.tool) return false;
      if (filter?.session && e.session !== filter.session) return false;
      if (filter?.status && e.result.status !== filter.status) return false;
      return true;
    });
  } catch { return []; }
}

export function getAuditStats(): { totalExecutions: number; totalErrors: number; averageScore: number; topTools: Array<{ tool: string; count: number }>; uptimeDays: number } {
  const entries = readAudits(10000);
  const errors = entries.filter((e) => e.result.status === "fail" || e.result.error);
  const withScore = entries.filter((e) => e.result.score !== undefined);
  const avgScore = withScore.length > 0 ? Math.round(withScore.reduce((s, e) => s + (e.result.score || 0), 0) / withScore.length) : 0;
  const toolCounts: Record<string, number> = {};
  for (const e of entries) toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
  const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tool, count]) => ({ tool, count }));

  const firstEntry = entries[0];
  const uptimeDays = firstEntry ? Math.round((Date.now() - new Date(firstEntry.timestamp).getTime()) / 86400000) : 0;

  return { totalExecutions: entries.length, totalErrors: errors.length, averageScore: avgScore, topTools, uptimeDays };
}

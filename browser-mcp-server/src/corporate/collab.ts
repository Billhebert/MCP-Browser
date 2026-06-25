import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const ANNOTATIONS = new Map<string, Array<{ author: string; text: string; createdAt: string }>>();

const SCHEDULES: Array<{ id: string; cron: string; tool: string; args: Record<string, unknown>; lastRun: number; enabled: boolean }> = [];
let scheduleCounter = 0;

export function addAnnotation(issueKey: string, author: string, text: string): void {
  if (!ANNOTATIONS.has(issueKey)) ANNOTATIONS.set(issueKey, []);
  ANNOTATIONS.get(issueKey)!.push({ author, text, createdAt: new Date().toISOString() });
}

export function getAnnotations(issueKey: string): Array<{ author: string; text: string; createdAt: string }> {
  return ANNOTATIONS.get(issueKey) || [];
}

export function listAnnotationKeys(): string[] {
  return Array.from(ANNOTATIONS.keys());
}

export function addSchedule(cron: string, tool: string, args: Record<string, unknown>): string {
  const id = `schedule-${++scheduleCounter}`;
  SCHEDULES.push({ id, cron, tool, args, lastRun: 0, enabled: true });
  return id;
}

export function listSchedules(): Array<{ id: string; cron: string; tool: string; enabled: boolean; lastRun: number }> {
  return SCHEDULES.map((s) => ({ id: s.id, cron: s.cron, tool: s.tool, enabled: s.enabled, lastRun: s.lastRun }));
}

export function removeSchedule(id: string): boolean {
  const idx = SCHEDULES.findIndex((s) => s.id === id);
  if (idx >= 0) { SCHEDULES.splice(idx, 1); return true; }
  return false;
}

export function toggleSchedule(id: string, enabled: boolean): boolean {
  const s = SCHEDULES.find((s) => s.id === id);
  if (!s) return false;
  s.enabled = enabled;
  return true;
}

export async function checkSchedules(): Promise<void> {
  const now = Date.now();
  for (const schedule of SCHEDULES) {
    if (!schedule.enabled) continue;
    const parts = schedule.cron.split(" ");
    if (parts.length < 5) continue;
    const minute = parseInt(parts[0]) || 0;
    const hour = parseInt(parts[1]) || 0;
    const d = new Date();
    const currentMinute = d.getMinutes();
    const currentHour = d.getHours();
    const scheduleMinute = now - schedule.lastRun > 60000;
    if (currentMinute === minute && currentHour === hour && scheduleMinute) {
      schedule.lastRun = now;
      try {
        console.error(`[Scheduler] Running ${schedule.tool}`);
      } catch (e) {
        console.error(`[Scheduler] Failed ${schedule.tool}: ${(e as Error).message}`);
      }
    }
  }
}

setInterval(checkSchedules, 30000);

import fs from "fs";
import path from "path";
import os from "os";

const SESSIONS_DIR = process.env.BVP_SESSIONS_DIR || path.join(os.homedir(), ".bvp-sessions");
const PERSIST_INTERVAL = 60000;
const CLEANUP_INTERVAL = 300000;
const DEFAULT_MAX_AGE = 86400000;

interface SessionData {
  createdAt: number;
  lastAccessed: number;
  user: string;
  toolCount: number;
  data: Record<string, unknown>;
}

const sessions = new Map<string, SessionData>();
let persistTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let dirty = false;

function loadSessions(): void {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  for (const file of fs.readdirSync(SESSIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = fs.readFileSync(path.join(SESSIONS_DIR, file), "utf-8");
      const session = JSON.parse(content) as SessionData;
      sessions.set(file.replace(".json", ""), session);
    } catch { /* skip corrupt files */ }
  }
}

function saveSessions(): void {
  if (!dirty) return;
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  for (const [name, data] of sessions) {
    try {
      fs.writeFileSync(path.join(SESSIONS_DIR, `${name}.json`), JSON.stringify(data));
    } catch { /* skip write errors */ }
  }
  dirty = false;
}

export function getSession(name: string, user = "anonymous"): SessionData {
  if (!sessions.has(name)) {
    sessions.set(name, {
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      user,
      toolCount: 0,
      data: {},
    });
    dirty = true;
  }
  const session = sessions.get(name)!;
  session.lastAccessed = Date.now();
  session.toolCount++;
  if (session.user === "anonymous" && user !== "anonymous") {
    session.user = user;
  }
  dirty = true;
  return session;
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

export function deleteSession(name: string): boolean {
  const deleted = sessions.delete(name);
  if (deleted) {
    const filePath = path.join(SESSIONS_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    dirty = true;
  }
  return deleted;
}

export function cleanupSessions(maxAgeMs = DEFAULT_MAX_AGE): number {
  const now = Date.now();
  let removed = 0;
  for (const [name, session] of sessions) {
    if (now - session.lastAccessed > maxAgeMs) {
      sessions.delete(name);
      const filePath = path.join(SESSIONS_DIR, `${name}.json`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      removed++;
    }
  }
  if (removed > 0) dirty = true;
  return removed;
}

export function getSessionData(name: string): Record<string, unknown> | undefined {
  return sessions.get(name)?.data;
}

export function setSessionData(name: string, key: string, value: unknown): void {
  const session = sessions.get(name);
  if (session) {
    session.data[key] = value;
    dirty = true;
  }
}

export function startSessionPersistence(): void {
  loadSessions();
  persistTimer = setInterval(saveSessions, PERSIST_INTERVAL);
  cleanupTimer = setInterval(() => cleanupSessions(), CLEANUP_INTERVAL);
}

export function stopSessionPersistence(): void {
  saveSessions();
  if (persistTimer) clearInterval(persistTimer);
  if (cleanupTimer) clearInterval(cleanupTimer);
}
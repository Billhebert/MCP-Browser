import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

interface SessionInfo {
  id: string;
  label: string;
  createdAt: number;
  context: BrowserContext | null;
  page: Page | null;
  lastActivity: number;
  status: "active" | "closed";
  consoleLogs: Array<{ type: string; text: string; timestamp: number }>;
  networkLogs: Array<Record<string, unknown>>;
}

const MAX_CONSOLE_LOGS = 200;
const MAX_NETWORK_LOGS = 500;
const PERSISTENT_DIR = path.join(os.homedir(), ".bvp-browser-profile");

const sessions = new Map<string, SessionInfo>();
let currentSessionId = "default";
let browser: any = null;

async function getBrowser(): Promise<any> {
  if (!browser || !browser.isConnected()) {
    const headless = process.env.BROWSER_HEADLESS !== "false";
    browser = await chromium.launch({
      headless,
      args: ["--no-sandbox"],
    });
    console.error(`🌐 Navegador iniciado para multi-session`);
  }
  return browser;
}

async function createContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  if (!fs.existsSync(PERSISTENT_DIR)) fs.mkdirSync(PERSISTENT_DIR, { recursive: true });
  const storagePath = path.join(PERSISTENT_DIR, "storage.json");
  return await b.newContext({
    locale: "pt-BR",
    permissions: ["clipboard-read", "clipboard-write"],
    ...(fs.existsSync(storagePath) ? { storageState: storagePath } : {}),
  });
}

export async function createSession(label?: string): Promise<string> {
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const session: SessionInfo = {
    id,
    label: label || `Session ${sessions.size + 1}`,
    createdAt: Date.now(),
    context: null,
    page: null,
    lastActivity: Date.now(),
    status: "active",
    consoleLogs: [],
    networkLogs: [],
  };

  try {
    const ctx = await createContext();
    session.context = ctx;
    const page = await ctx.newPage();
    session.page = page;

    page.on("console", (msg) => {
      const entry = { type: msg.type(), text: msg.text(), timestamp: Date.now() };
      session.consoleLogs.push(entry);
      if (session.consoleLogs.length > MAX_CONSOLE_LOGS) session.consoleLogs.shift();
    });

    page.on("pageerror", (err) => {
      session.consoleLogs.push({ type: "pageerror", text: err.message, timestamp: Date.now() });
    });

    (page as any).on("response", (response: any) => {
      const req = response.request();
      let headers: Record<string, string> = {};
      try { headers = response.headers(); } catch {}
      session.networkLogs.push({
        method: req.method,
        url: response.url(),
        status: response.status(),
        timestamp: Date.now(),
        type: req.resourceType,
      });
      if (session.networkLogs.length > MAX_NETWORK_LOGS) session.networkLogs.shift();
    });
  } catch (err) {
    console.error(`⚠️ Session ${id}: failed to create browser context: ${(err as Error).message}`);
  }

  sessions.set(id, session);
  console.error(`🆕 Session created: ${id} (${session.label})`);
  return id;
}

export async function switchSession(id: string): Promise<boolean> {
  if (!sessions.has(id)) return false;
  currentSessionId = id;
  sessions.get(id)!.lastActivity = Date.now();
  return true;
}

export function getCurrentSessionId(): string {
  return currentSessionId;
}

export async function getCurrentPage(): Promise<Page | null> {
  return getSessionPage(currentSessionId);
}

export async function getSessionPage(sessionId: string): Promise<Page | null> {
  const session = sessions.get(sessionId);
  if (!session || session.status === "closed") return null;

  if (!session.page || session.page.isClosed()) {
    try {
      if (session.context) {
        session.page = await session.context.newPage();
      }
    } catch {
      return null;
    }
  }

  if (session.page) {
    try {
      await session.page.evaluate("1");
    } catch {
      try {
        if (session.context) session.page = await session.context.newPage();
        else return null;
      } catch { return null; }
    }
  }
  return session.page;
}

export function getSessionInfo(sessionId: string): Record<string, unknown> | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  return {
    id: s.id,
    label: s.label,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
    status: s.status,
    consoleLogCount: s.consoleLogs.length,
    networkLogCount: s.networkLogs.length,
    url: s.page?.url() || null,
    title: s.page ? s.page.url() : null,
  };
}

export function listSessionsInfo(): Record<string, unknown>[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    label: s.label,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
    status: s.status,
    consoleLogCount: s.consoleLogs.length,
    networkLogCount: s.networkLogs.length,
    isCurrent: s.id === currentSessionId,
    url: s.page?.url() || null,
  }));
}

export async function closeSession(id: string): Promise<boolean> {
  const session = sessions.get(id);
  if (!session) return false;

  session.status = "closed";
  try {
    if (session.page && !session.page.isClosed()) await session.page.close();
    if (session.context) await session.context.close();
  } catch {}

  if (currentSessionId === id) {
    const remaining = Array.from(sessions.values()).filter((s) => s.status === "active");
    if (remaining.length > 0) currentSessionId = remaining[0].id;
    else currentSessionId = "default";
  }

  sessions.delete(id);
  console.error(`🗑️ Session closed: ${id}`);
  return true;
}

export async function closeAllSessions(): Promise<void> {
  for (const [id] of sessions) {
    await closeSession(id);
  }
  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
  }
}

export function getSessionConsoleLogs(sessionId: string) {
  return sessions.get(sessionId)?.consoleLogs || [];
}

export function getSessionNetworkLogs(sessionId: string) {
  return sessions.get(sessionId)?.networkLogs || [];
}

export function clearSessionLogs(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) {
    s.consoleLogs = [];
    s.networkLogs = [];
  }
}

export async function ensureDefaultSession(): Promise<void> {
  if (!sessions.has("default")) {
    const ctx = await createContext();
    const page = await ctx.newPage();
    const session: SessionInfo = {
      id: "default",
      label: "Default",
      createdAt: Date.now(),
      context: ctx,
      page,
      lastActivity: Date.now(),
      status: "active",
      consoleLogs: [],
      networkLogs: [],
    };
    sessions.set("default", session);
    currentSessionId = "default";
  }
}

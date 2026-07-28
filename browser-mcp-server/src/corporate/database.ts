import initSqlJs, { type Database } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DB_PATH = path.join(os.homedir(), ".bvp-browser", "data.db");

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    tool TEXT NOT NULL,
    user TEXT NOT NULL DEFAULT 'local',
    session TEXT NOT NULL DEFAULT 'default',
    args TEXT,
    result TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS scheduled_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    cron TEXT NOT NULL,
    categories TEXT DEFAULT 'all',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_run TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    tags TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS plugins (
    name TEXT PRIMARY KEY,
    version TEXT,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    installed_at TEXT NOT NULL
  )`);

  save();
  console.error(`🗄️ Database initialized: ${DB_PATH}`);
  return db;
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

export function save(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

export function insertAudit(entry: {
  timestamp: string;
  tool: string;
  user: string;
  session: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs: number;
}): void {
  const d = getDb();
  d.run(
    `INSERT INTO audits (timestamp, tool, user, session, args, result, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.timestamp,
      entry.tool,
      entry.user,
      entry.session,
      JSON.stringify(entry.args),
      JSON.stringify(entry.result),
      entry.durationMs,
    ],
  );
  save();
}

export function queryAudits(limit = 200, offset = 0): Record<string, unknown>[] {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM audits ORDER BY id DESC LIMIT ? OFFSET ?`);
  stmt.bind([limit, offset]);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    try { if (typeof row.args === "string") row.args = JSON.parse(row.args as string); } catch {}
    try { if (typeof row.result === "string") row.result = JSON.parse(row.result as string); } catch {}
    rows.push(row);
  }
  stmt.free();
  return rows;
}

export function getAuditStats(): Record<string, unknown> {
  const d = getDb();
  const total = d.exec(`SELECT COUNT(*) as count FROM audits`)[0]?.values[0]?.[0] || 0;
  const byTool = d.exec(`SELECT tool, COUNT(*) as count FROM audits GROUP BY tool ORDER BY count DESC LIMIT 20`);
  const errors = d.exec(`SELECT COUNT(*) as count FROM audits WHERE json_extract(result, '$.status') = 'fail'`)[0]?.values[0]?.[0] || 0;
  return {
    total,
    errors,
    topTools: byTool.map((r: any) => ({ tool: r[0], count: r[1] })),
  };
}

export function upsertSetting(key: string, value: string): void {
  const d = getDb();
  d.run(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, [key, value, new Date().toISOString()]);
  save();
}

export function getSetting(key: string): string | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT value FROM settings WHERE key = ?`);
  stmt.bind([key]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return (row as any).value as string || null;
  }
  stmt.free();
  return null;
}

export function getAllSettings(): Record<string, string> {
  const d = getDb();
  const result: Record<string, string> = {};
  const stmt = d.prepare(`SELECT key, value FROM settings`);
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    result[row.key] = row.value;
  }
  stmt.free();
  return result;
}

export function registerPlugin(name: string, version: string, description: string): void {
  const d = getDb();
  d.run(
    `INSERT OR REPLACE INTO plugins (name, version, description, enabled, installed_at) VALUES (?, ?, ?, 1, ?)`,
    [name, version, description, new Date().toISOString()],
  );
  save();
}

export function listPlugins(): Record<string, unknown>[] {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM plugins ORDER BY installed_at DESC`);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function togglePlugin(name: string, enabled: boolean): void {
  const d = getDb();
  d.run(`UPDATE plugins SET enabled = ? WHERE name = ?`, [enabled ? 1 : 0, name]);
  save();
}

export function saveSnapshot(name: string, data: Record<string, unknown>, tags?: string[]): void {
  const d = getDb();
  d.run(
    `INSERT OR REPLACE INTO snapshots (name, data, created_at, tags) VALUES (?, ?, ?, ?)`,
    [name, JSON.stringify(data), new Date().toISOString(), tags ? JSON.stringify(tags) : null],
  );
  save();
}

export function getSnapshot(name: string): Record<string, unknown> | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM snapshots WHERE name = ?`);
  stmt.bind([name]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();
    try { row.data = JSON.parse(row.data); } catch {}
    try { row.tags = JSON.parse(row.tags || "[]"); } catch {}
    return row;
  }
  stmt.free();
  return null;
}

export function listSnapshots(): Record<string, unknown>[] {
  const d = getDb();
  const stmt = d.prepare(`SELECT name, created_at, tags FROM snapshots ORDER BY created_at DESC`);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    try { row.tags = JSON.parse(row.tags || "[]"); } catch {}
    rows.push(row);
  }
  stmt.free();
  return rows;
}

export function deleteSnapshot(name: string): void {
  const d = getDb();
  d.run(`DELETE FROM snapshots WHERE name = ?`, [name]);
  save();
}

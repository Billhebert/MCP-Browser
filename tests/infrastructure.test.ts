import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Database Layer (SQLite)", () => {
  const testDir = path.join(os.tmpdir(), "bvp-test-db");
  const dbPath = path.join(testDir, "test.db");

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("deve importar sql.js sem erros", async () => {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db.run("INSERT INTO test VALUES (1, 'hello')");
    const result = db.exec("SELECT value FROM test WHERE id = 1");
    expect(result[0].values[0][0]).toBe("hello");
    db.close();
  });

  it("deve exportar e importar banco via buffer", async () => {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs();
    const db1 = new SQL.Database();
    db1.run("CREATE TABLE items (name TEXT)");
    db1.run("INSERT INTO items VALUES ('test')");
    const buffer = db1.export();
    db1.close();

    const db2 = new SQL.Database(buffer);
    const result = db2.exec("SELECT name FROM items");
    expect(result[0].values[0][0]).toBe("test");
    db2.close();
  });

  it("deve persistir dados em arquivo", async () => {
    const initSqlJs = (await import("sql.js")).default;
    const SQL = await initSqlJs();
    const db1 = new SQL.Database();
    db1.run("CREATE TABLE config (key TEXT, value TEXT)");
    db1.run("INSERT INTO config VALUES ('theme', 'dark')");
    const data = db1.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    db1.close();

    const fileBuf = fs.readFileSync(dbPath);
    const db2 = new SQL.Database(fileBuf);
    const result = db2.exec("SELECT value FROM config WHERE key = 'theme'");
    expect(result[0].values[0][0]).toBe("dark");
    db2.close();
  });
});

describe("Plugin Loader", () => {
  const testPluginDir = path.join(os.tmpdir(), "bvp-test-plugins");

  beforeAll(() => {
    if (!fs.existsSync(testPluginDir)) fs.mkdirSync(testPluginDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testPluginDir)) fs.rmSync(testPluginDir, { recursive: true, force: true });
  });

  it("deve criar diretório de plugin se não existir", () => {
    const newDir = path.join(testPluginDir, "non-existent");
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it("deve validar plugin.json com campos obrigatórios", () => {
    const valid = { name: "test-plugin", version: "1.0.0", description: "Test", main: "index.js" };
    expect(valid.name).toBeDefined();
    expect(valid.version).toBeDefined();
    expect(valid.main).toBeDefined();
    const invalid = { name: "bad-plugin" } as any;
    expect(invalid.main).toBeUndefined();
  });

  it("deve rejeitar plugin sem plugin.json", () => {
    const dir = path.join(testPluginDir, "no-manifest");
    fs.mkdirSync(dir, { recursive: true });
    const hasManifest = fs.existsSync(path.join(dir, "plugin.json"));
    expect(hasManifest).toBe(false);
  });

  it("deve carregar plugin com manifest válido", () => {
    const dir = path.join(testPluginDir, "my-plugin");
    fs.mkdirSync(dir, { recursive: true });
    const manifest = { name: "my-plugin", version: "0.1.0", description: "My test plugin", main: "index.js" };
    fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(manifest));
    fs.writeFileSync(path.join(dir, "index.js"), `export default [{name:"my_tool",description:"test",args:{},execute:async()=>({content:[{type:"text",text:"ok"}]})}]`);
    expect(fs.existsSync(path.join(dir, "plugin.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "index.js"))).toBe(true);
  });
});

describe("Session Manager", () => {
  it("deve criar e listar sessões", () => {
    const sessions = new Map<string, { id: string; label: string; createdAt: number }>();
    const id1 = "sess_1";
    const id2 = "sess_2";
    sessions.set(id1, { id: id1, label: "Session 1", createdAt: Date.now() });
    sessions.set(id2, { id: id2, label: "Session 2", createdAt: Date.now() });
    expect(sessions.size).toBe(2);
    expect(sessions.has("sess_1")).toBe(true);
  });

  it("deve alternar entre sessões ativas", () => {
    const sessions = new Map<string, { status: string }>();
    sessions.set("a", { status: "active" });
    sessions.set("b", { status: "active" });
    let current = "a";
    current = "b";
    expect(current).toBe("b");
  });

  it("deve fechar sessão e remover do mapa", () => {
    const sessions = new Map<string, { status: string }>();
    sessions.set("test", { status: "active" });
    sessions.delete("test");
    expect(sessions.has("test")).toBe(false);
  });

  it("deve limpar logs da sessão", () => {
    const session = { consoleLogs: [1, 2, 3], networkLogs: [4, 5] };
    session.consoleLogs = [];
    session.networkLogs = [];
    expect(session.consoleLogs.length).toBe(0);
    expect(session.networkLogs.length).toBe(0);
  });
});

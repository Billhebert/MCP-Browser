import type { Express, Request, Response, NextFunction } from "express";
import { tools, toolMap, getTool, convertToMCPTool } from "../tools/registry.js";
import { validateApiKey } from "../corporate/auth.js";
import { ToolExecutorService } from "../services/toolExecutorService.js";
import { incRequestCount } from "../corporate/health.js";
import { queryAudits, getAuditStats, upsertSetting, getAllSettings, listPlugins, togglePlugin, listSnapshots, getSnapshot, saveSnapshot, deleteSnapshot } from "../corporate/database.js";
import { getLoadedPlugins } from "../corporate/pluginLoader.js";
import { createSession, switchSession, getSessionInfo, listSessionsInfo, closeSession, getCurrentSessionId } from "../corporate/sessionManager.js";
import { VERSION } from "../version.js";
import { AuthError, RateLimitError, NotFoundError } from "../contracts/errors.js";

const executor = new ToolExecutorService();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err) => {
      console.error(`[API Error] ${req.method} ${req.path}:`, err.message);
      const status = err instanceof NotFoundError ? 404 : err instanceof AuthError ? 401 : err instanceof RateLimitError ? 429 : 500;
      res.status(status).json({ error: err.message });
    });
  };
}

export function setupApiRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), version: VERSION });
  });

  app.get("/api/tools", (_req, res) => {
    res.json({ tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      args: Object.entries(t.args).map(([key, zodType]) => ({
        name: key,
        type: getZodJsonType(zodType),
        description: zodType.description || key,
        required: !zodType.isOptional(),
      })),
    })), count: tools.length });
  });

  app.get("/api/tools/:name", (req, res) => {
    const name = String(req.params.name);
    const tool = toolMap.get(name);
    if (!tool) { res.status(404).json({ error: `Tool "${name}" not found` }); return; }
    res.json({
      name: tool.name,
      description: tool.description,
      args: Object.entries(tool.args).map(([key, zodType]) => ({
        name: key,
        type: getZodJsonType(zodType),
        description: zodType.description || key,
        required: !zodType.isOptional(),
      })),
    });
  });

  app.post("/api/tools/:name/execute", asyncHandler(async (req, res) => {
    const name = String(req.params.name);
    const args = req.body?.args || {};
    const apiKey = String(req.headers["x-api-key"] || "");
    const sessionId = (req.body?.sessionId as string) || getCurrentSessionId();

    incRequestCount();
    const auth = validateApiKey(apiKey || undefined);
    if (!auth.valid) throw new AuthError();

    const { result } = await executor.execute({ toolName: name, args, user: auth.user, sessionId });

    res.json({
      success: !result.isError,
      result: result.content,
      isError: result.isError,
      sessionId,
    });
  }));

  app.get("/api/audits", asyncHandler(async (_req, res) => {
    res.json({ audits: queryAudits(200) });
  }));

  app.get("/api/audits/stats", asyncHandler(async (_req, res) => {
    res.json(await getAuditStats());
  }));

  app.get("/api/stats", (_req, res) => {
    res.json({ version: VERSION, uptime: process.uptime(), toolCount: tools.length, pluginCount: getLoadedPlugins().length, timestamp: new Date().toISOString() });
  });

  app.get("/api/sessions", asyncHandler(async (_req, res) => {
    res.json({ sessions: listSessionsInfo(), current: getCurrentSessionId() });
  }));

  app.post("/api/sessions", asyncHandler(async (req, res) => {
    const id = await createSession(req.body?.label as string);
    res.status(201).json({ id, label: req.body?.label || id });
  }));

  app.post("/api/sessions/:id/switch", asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!await switchSession(id)) throw new NotFoundError("Session", id);
    res.json({ current: id });
  }));

  app.post("/api/sessions/:id/close", asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!await closeSession(id)) throw new NotFoundError("Session", id);
    res.json({ closed: id });
  }));

  app.get("/api/sessions/:id", asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const info = getSessionInfo(id);
    if (!info) throw new NotFoundError("Session", id);
    res.json(info);
  }));

  app.get("/api/plugins", asyncHandler(async (_req, res) => {
    res.json({ plugins: listPlugins(), loaded: getLoadedPlugins().map((p) => ({ name: p.manifest.name, version: p.manifest.version, description: p.manifest.description, tools: p.tools.length })) });
  }));

  app.post("/api/plugins/:name/toggle", asyncHandler(async (req, res) => {
    togglePlugin(String(req.params.name), req.body?.enabled === true);
    res.json({ name: String(req.params.name), enabled: req.body?.enabled === true });
  }));

  app.get("/api/settings", asyncHandler(async (_req, res) => {
    res.json({ settings: getAllSettings() });
  }));

  app.post("/api/settings/:key", asyncHandler(async (req, res) => {
    const key = String(req.params.key);
    if (req.body?.value === undefined) { res.status(400).json({ error: "value required" }); return; }
    upsertSetting(key, String(req.body.value));
    res.json({ key, value: String(req.body.value) });
  }));

  app.get("/api/snapshots", asyncHandler(async (_req, res) => {
    res.json({ snapshots: listSnapshots() });
  }));

  app.get("/api/snapshots/:name", asyncHandler(async (req, res) => {
    const name = String(req.params.name);
    const snap = getSnapshot(name);
    if (!snap) throw new NotFoundError("Snapshot", name);
    res.json(snap);
  }));

  app.post("/api/snapshots", asyncHandler(async (req, res) => {
    const { name, data, tags } = req.body || {};
    if (!name || !data) { res.status(400).json({ error: "name and data required" }); return; }
    saveSnapshot(name, data, tags);
    res.status(201).json({ name, saved: true });
  }));

  app.delete("/api/snapshots/:name", asyncHandler(async (req, res) => {
    deleteSnapshot(String(req.params.name));
    res.json({ deleted: String(req.params.name) });
  }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Unhandled Error]", err.message);
    res.status(500).json({ error: "Internal server error" });
  });
}

function getZodJsonType(zodType: any): string {
  let inner = zodType;
  while (inner._def?.innerType) inner = inner._def.innerType;
  const tn = inner._def?.typeName;
  if (tn === "ZodString") return "string";
  if (tn === "ZodNumber") return "number";
  if (tn === "ZodBoolean") return "boolean";
  if (tn === "ZodEnum") return "string";
  if (tn === "ZodArray") return "array";
  return "string";
}

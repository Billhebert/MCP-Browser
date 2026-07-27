import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { serialized, touchActivity, getLogMemoryUsage, getPage, getConsoleLogs, getNetworkLogs } from "./browser.js";
import { loadWebhooks, sendWebhook } from "./corporate/webhook.js";
import { writeAudit, readAudits } from "./corporate/auditTrail.js";
import { checkRateLimit } from "./corporate/rateLimiter.js";
import { getEnv } from "./corporate/env.js";
import { validateApiKey } from "./corporate/auth.js";
import { setToolExecutor } from "./corporate/collab.js";
import { startHealthServer, incRequestCount, incErrorCount, trackToolCall } from "./corporate/health.js";
import { createLogger } from "./corporate/logger.js";
import { startSessionPersistence } from "./corporate/sessions.js";
import { generateRequestId } from "./corporate/requestId.js";
import { toolMap, convertToMCPTool, ensureTools } from "./tools/registry.js";

export type { ToolDefinition } from "./tools/registry.js";

const rootLogger = createLogger({ service: "bvp-browser" });

// Register tool executor for the scheduler (collab.ts)
const schedulerLogger = rootLogger.child({ component: "scheduler" });
setToolExecutor(async (name: string, args: Record<string, unknown>) => {
  const tool = toolMap.get(name);
  if (!tool) {
    schedulerLogger.error("Unknown tool", { tool: name });
    return;
  }
  await tool.execute(args);
});

const server = new Server(
  { name: "bvp-browser", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const allTools = await ensureTools();
  return { tools: allTools.map(convertToMCPTool) };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  incRequestCount();

  // Auth check
  const apiKey = request.params?._meta?.apiKey as string | undefined;
  const auth = validateApiKey(apiKey);
  if (!auth.valid) {
    return {
      content: [{ type: "text", text: `Unauthorized: invalid API key` }],
      isError: true,
    };
  }

  const requestId = generateRequestId();
  const log = rootLogger.child({ requestId, tool: name, user: auth.user });

  const tool = toolMap.get(name);
  if (!tool) {
    log.warn("Unknown tool requested");
    return {
      content: [{ type: "text", text: `Ferramenta desconhecida: ${name}` }],
      isError: true,
    };
  }

  // Rate limit check (by user+tool)
  const rlKey = `${auth.user}:${name}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    log.warn("Rate limit exceeded", { resetInMs: rl.resetInMs, remaining: rl.remaining });
    return {
      content: [{ type: "text", text: `Rate limit exceeded for "${name}" (user: ${auth.user}). Try again in ${Math.ceil(rl.resetInMs / 1000)}s (limit: ${rl.remaining + 1}/min)` }],
      isError: true,
    };
  }

  const startTime = Date.now();
  let result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean };

  try {
    const parsedArgs: Record<string, unknown> = {};
    for (const [key, zodType] of Object.entries(tool.args)) {
      if (args && key in args) {
        parsedArgs[key] = zodType.parse(args[key]);
      }
    }
    touchActivity();
    result = await serialized(() => tool.execute(parsedArgs));
    trackToolCall(name, Date.now() - startTime, false);
    log.info("Tool executed successfully", { durationMs: Date.now() - startTime });
  } catch (err) {
    trackToolCall(name, Date.now() - startTime, true);
    log.error("Tool execution failed", { error: (err as Error).message });
    result = {
      content: [{ type: "text", text: `Erro: ${(err as Error).message}` }],
      isError: true,
    };
  }

  // Audit trail (fire-and-forget)
  const duration = Date.now() - startTime;
  const resText = result.content?.[0]?.text || "{}";
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(resText); } catch {}
  writeAudit({
    timestamp: new Date().toISOString(),
    tool: name,
    user: auth.user,
    session: "default",
    args: request.params.arguments || {},
    result: {
      status: result.isError ? "fail" : "pass",
      score: parsed.score as number | undefined,
      issueCount: Array.isArray(parsed.issues) ? parsed.issues.length : undefined,
    },
    durationMs: duration,
  });

  // Webhook on error
  if (result.isError) {
    incErrorCount();
    // Mask potential secrets before sending to webhook
    const maskedError = resText.replace(/(["']?(?:password|secret|token|api[_-]?key|authorization|auth)["']?\s*[:=]\s*["']?)[^"'\s,;}\]]+/gi, "$1***");
    sendWebhook("error", { tool: name, error: maskedError.slice(0, 200) });
  }

  return result;
});
// Resource handlers
const RESOURCE_PREFIX = "browser://";

const resourceDefinitions = [
  { uri: "browser://page/url", name: "Current Page URL", description: "URL da página atual", mimeType: "text/plain" },
  { uri: "browser://page/title", name: "Current Page Title", description: "Título da página atual", mimeType: "text/plain" },
  { uri: "browser://page/html", name: "Current Page HTML", description: "HTML completo da página atual", mimeType: "text/html" },
  { uri: "browser://console/logs", name: "Console Logs", description: "Logs do console do navegador", mimeType: "application/json" },
  { uri: "browser://network/logs", name: "Network Logs", description: "Logs de rede do navegador", mimeType: "application/json" },
  { uri: "browser://status", name: "Browser Status", description: "Status atual do navegador", mimeType: "application/json" },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: resourceDefinitions.map(r => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  try {
    const page = await getPage();
    switch (uri) {
      case "browser://page/url":
        return { contents: [{ uri, mimeType: "text/plain", text: page.url() }] };
      case "browser://page/title":
        return { contents: [{ uri, mimeType: "text/plain", text: await page.title() }] };
      case "browser://page/html":
        return { contents: [{ uri, mimeType: "text/html", text: await page.evaluate(() => document.documentElement.outerHTML) }] };
      case "browser://console/logs":
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(getConsoleLogs(), null, 2) }] };
      case "browser://network/logs":
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(getNetworkLogs(), null, 2) }] };
      case "browser://status": {
        const mem = getLogMemoryUsage();
        return {
          contents: [{
            uri, mimeType: "application/json",
            text: JSON.stringify({
              url: page.url(),
              title: await page.title(),
              consoleLogs: getConsoleLogs().length,
              networkLogs: getNetworkLogs().length,
              memory: mem,
            }, null, 2),
          }],
        };
      }
      default:
        return { contents: [{ uri, mimeType: "text/plain", text: `Resource not found: ${uri}` }], isError: true };
    }
  } catch (err) {
    return { contents: [{ uri, mimeType: "text/plain", text: `Error: ${(err as Error).message}` }], isError: true };
  }
});

// Prompt handlers
const promptDefinitions = [
  {
    name: "audit-page",
    description: "Auditar a página atual para qualidade, acessibilidade e performance",
    arguments: [
      { name: "focus", description: "Área de foco: all, a11y, performance, seo, security", required: false },
    ],
  },
  {
    name: "check-a11y",
    description: "Verificar acessibilidade da página conforme WCAG 2.2 AA",
    arguments: [
      { name: "standard", description: "Padrão: wcag22aa, wcag21aa", required: false },
    ],
  },
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: promptDefinitions,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "audit-page": {
      const focus = args?.focus || "all";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Execute uma auditoria completa na página atual com foco em: ${focus}. Use as ferramentas: check_a11y, analyze_seo, check_security, check_contrast, check_images, lighthouse_audit, check_links, validate_html, validate_json_ld, check_spelling, check_readability. Para cada ferramenta, execute e reporte os resultados.`,
          },
        }],
      };
    }
    case "check-a11y": {
      const standard = args?.standard || "wcag22aa";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Execute uma auditoria de acessibilidade (padrão: ${standard}) usando a ferramenta check_a11y. Depois, se houver violações, use explain_issue para explicar cada uma e suggest_fixes para sugerir correções.`,
          },
        }],
      };
    }
    default:
      return { messages: [{ role: "user", content: { type: "text", text: `Prompt not found: ${name}` } }] };
  }
});

async function main() {
  getEnv();
  loadWebhooks();
  startHealthServer();
  startSessionPersistence();
  const healthPort = parseInt(process.env.BVP_HEALTH_PORT || "9090");

  // Start stdio transport
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  rootLogger.info("BVP Browser MCP Server started (stdio)");

  // Start Streamable HTTP transport
  const mcpPort = parseInt(process.env.BVP_MCP_PORT || "3100");
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => generateRequestId(),
  });
  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/mcp") {
      const buffers: Buffer[] = [];
      for await (const chunk of req) buffers.push(chunk);
      const body = Buffer.concat(buffers).toString();
      try {
        await httpTransport.handleRequest(req, res, JSON.parse(body));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    } else if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    } else if (req.method === "GET" && req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      const { requestCount: rc, errorCount: ec, startTime: st } = await import("./corporate/health.js");
      const lines = [
        "# HELP bvp_requests_total Total requests",
        "# TYPE bvp_requests_total counter",
        "bvp_requests_total " + rc,
        "# HELP bvp_errors_total Total errors",
        "# TYPE bvp_errors_total counter",
        "bvp_errors_total " + ec,
        "# HELP bvp_uptime_seconds Server uptime",
        "# TYPE bvp_uptime_seconds gauge",
        "bvp_uptime_seconds " + Math.floor((Date.now() - st) / 1000),
      ];
      res.end(lines.join("\n") + "\n");
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  httpServer.listen(mcpPort, () => {
    rootLogger.info("BVP Browser MCP Server started (HTTP)", { port: mcpPort });
  });

  // Store for graceful shutdown
  (globalThis as any).__bvpHttpServer = httpServer;
  (globalThis as any).__bvpHttpTransport = httpTransport;

  // Connect HTTP transport to the same server
  await server.connect(httpTransport);
}

// Graceful shutdown
async function shutdown(signal: string) {
  rootLogger.info("Shutting down", { signal });
  try {
    const { closeBrowser } = await import("./browser.js");
    await closeBrowser();
  } catch {}
  try {
    const httpServer = (globalThis as any).__bvpHttpServer;
    if (httpServer) httpServer.close();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  rootLogger.error("Uncaught exception", { error: err.message });
  shutdown("uncaughtException");
});

main().catch((err) => {
  rootLogger.error("Fatal error", { error: err.message });
  process.exit(1);
});

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { serialized } from "./browser.js";
import { loadWebhooks, sendWebhook } from "./corporate/webhook.js";
import { writeAudit, readAudits } from "./corporate/auditTrail.js";
import { checkRateLimit } from "./corporate/rateLimiter.js";
import { validateApiKey } from "./corporate/auth.js";
import { setToolExecutor } from "./corporate/collab.js";
import { startHealthServer, incRequestCount, incErrorCount } from "./corporate/health.js";
import { createLogger } from "./corporate/logger.js";
import { generateRequestId } from "./corporate/requestId.js";
import { tools, toolMap, convertToMCPTool } from "./tools/registry.js";

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
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(convertToMCPTool),
}));

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
    result = await serialized(() => tool.execute(parsedArgs));
    log.info("Tool executed successfully", { durationMs: Date.now() - startTime });
  } catch (err) {
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

async function main() {
  loadWebhooks();
  startHealthServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  rootLogger.info("BVP Browser MCP Server started");
}

// Graceful shutdown
async function shutdown(signal: string) {
  rootLogger.info("Shutting down", { signal });
  try {
    const { closeBrowser } = await import("./browser.js");
    await closeBrowser();
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

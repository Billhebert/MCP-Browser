import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";
import { getAuditStats } from "../corporate/auditTrail.js";
import { listSessions, cleanupSessions } from "../corporate/sessions.js";
import { getRateLimitStatus } from "../corporate/rateLimiter.js";

export const healthCheckTool: ToolDefinition = {
  name: "health_check",
  description:
    "Verificar saúde do servidor MCP e do navegador. Retorna status do browser, estatísticas de auditoria, sessões ativas, rate limiting, e versão do servidor. Essencial para monitoramento corporativo.",
  args: {},
  async execute() {
    let browserStatus = "unknown";
    let pageUrl = "";
    let pageTitle = "";
    try {
      const page = await getPage();
      pageUrl = page.url();
      pageTitle = await page.title();
      browserStatus = "connected";
    } catch (e) {
      browserStatus = `error: ${(e as Error).message.slice(0, 100)}`;
    }

    const stats = getAuditStats();
    const sessions = listSessions();
    const rateLimit = getRateLimitStatus("global");
    cleanupSessions();

    const upSince = new Date(Date.now() - stats.uptimeDays * 86400000).toISOString();

    console.error(`💚 Health: browser ${browserStatus}, ${stats.totalExecutions} audits, ${sessions.length} sessions`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        status: browserStatus === "connected" ? "healthy" : "degraded",
        version: "1.0.0-corporate",
        uptime: { days: stats.uptimeDays, since: upSince },
        browser: { status: browserStatus, currentUrl: pageUrl, currentTitle: pageTitle },
        audit: stats,
        sessions: { active: sessions.length, names: sessions },
        rateLimit,
      }, null, 2) }],
    };
  },
};

import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";
import { getAuditStats } from "../corporate/auditTrail.js";
import { listSessionsInfo } from "../corporate/sessionManager.js";
import { getRateLimitStatus } from "../corporate/rateLimiter.js";

export const healthCheckTool: ToolDefinition = {
  name: "health_check",
  description: "Check server and browser health status.",
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

    const stats = await getAuditStats();
    const sessions = listSessionsInfo();
    const rateLimit = getRateLimitStatus("global");

    return {
      content: [{ type: "text", text: JSON.stringify({
        status: browserStatus === "connected" ? "healthy" : "degraded",
        version: "1.0.0",
        browser: { status: browserStatus, currentUrl: pageUrl, currentTitle: pageTitle },
        audit: stats,
        sessions,
        rateLimit,
      }, null, 2) }],
    };
  },
};

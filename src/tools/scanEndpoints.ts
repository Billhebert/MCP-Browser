import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const scanEndpointsTool: ToolDefinition = {
  name: "scan_endpoints",
  description: "Descobre endpoints de API, links, e recursos da página current. Analisa: URLs em atributos href/src, chamadas de rede, paths em scripts, webhooks, e possíveis endpoints REST/GraphQL. Retorna inventário classificado por tipo.",
  args: {
    deep: z.string().max(10).optional().describe("Scan profundo? 'true' para analisar conteúdo de scripts também (padrão: 'false')"),
  },
  async execute(args: { deep?: string }) {
    const page = await getPage();
    const url = page.url();
    const deep = args.deep === "true";
    console.error(`🔍 Scanning endpoints: ${url}`);

    const networkLogs = getNetworkLogs();
    const baseOrigin = new URL(url).origin;

    const endpoints: Array<{ url: string; type: string; method?: string; status?: number; source: string }> = [];

    for (const req of networkLogs) {
      if (!req.url) continue;
      try {
        const u = new URL(req.url);
        const path = u.pathname + u.search;
        let type = "resource";
        if (path.includes("/api/") || path.includes("/rest/") || path.includes("/v1/") || path.includes("/v2/") || path.includes("/graphql")) {
          type = "api";
        } else if (req.type === "xhr" || req.type === "fetch") {
          type = "api";
        } else if (path.endsWith(".js")) type = "script";
        else if (path.endsWith(".css")) type = "stylesheet";
        else if (path.endsWith(".json")) type = "json";

        if (!endpoints.some((e) => e.url === req.url)) {
          endpoints.push({
            url: req.url,
            type,
            method: req.method,
            status: req.status,
            source: req.url.includes(baseOrigin) ? "same-origin" : "third-party",
          });
        }
      } catch {}
    }

    const foundInPage = await page.evaluate((deepScan) => {
      const results: Array<{ url: string; type: string; source: string }> = [];
      const seen = new Set<string>();

      document.querySelectorAll("a[href]").forEach((a) => {
        const href = (a as HTMLAnchorElement).href || a.getAttribute("href") || "";
        if (href && !seen.has(href) && (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//") || href.startsWith("/api/"))) {
          seen.add(href);
          results.push({ url: href, type: "link", source: a.getAttribute("rel") || "link" });
        }
      });

      document.querySelectorAll("form[action]").forEach((f) => {
        const action = f.getAttribute("action") || "";
        if (action && !seen.has(action)) {
          seen.add(action);
          results.push({ url: action, type: "form-action", source: "form" });
        }
      });

      if (deepScan) {
        document.querySelectorAll("script").forEach((s) => {
          const text = s.textContent || "";
          const apiRe = /["']((?:https?:\/\/[^"'\s]+)|(?:\/[^"'\s]+\/api\/[^"'\s]+)|(?:\/[^"'\s]+\/v[12]\/[^"'\s]+))["']/g;
          let m;
          while ((m = apiRe.exec(text)) !== null) {
            if (!seen.has(m[1])) {
              seen.add(m[1]);
              results.push({ url: m[1], type: "api-in-script", source: "inline-script" });
            }
          }
          const webhookRe = /["']((?:https?:\/\/hooks?\.slack|discord|webhook|hooks\.zapier|api\.telegram)[^"'\s]+)["']/g;
          while ((m = webhookRe.exec(text)) !== null) {
            if (!seen.has(m[1])) {
              seen.add(m[1]);
              results.push({ url: m[1], type: "webhook", source: "inline-script" });
            }
          }
        });
      }

      return results;
    }, deep);

    for (const item of foundInPage) {
      if (!endpoints.some((e) => e.url === item.url)) {
        endpoints.push({ ...item, method: undefined, status: undefined });
      }
    }

    const byType: Record<string, number> = {};
    for (const ep of endpoints) {
      byType[ep.type] = (byType[ep.type] || 0) + 1;
    }

    const apiEndpoints = endpoints.filter((e) => e.type === "api" || e.type === "api-in-script" || e.type === "webhook" || e.type === "graphql");
    const potentialAuth = apiEndpoints.filter((e) =>
      e.url.includes("login") || e.url.includes("auth") || e.url.includes("token") || e.url.includes("signin") || e.url.includes("oauth")
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            totalFound: endpoints.length,
            apiEndpoints: apiEndpoints.length,
            uniqueDomains: [...new Set(endpoints.map((e) => { try { return new URL(e.url).hostname } catch { return "invalid" } }))],
            summary: byType,
            authenticationEndpoints: potentialAuth.map((e) => e.url),
            endpoints: endpoints.sort((a, b) => a.type.localeCompare(b.type)),
          }, null, 2),
        },
      ],
    };
  },
};

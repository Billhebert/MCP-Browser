import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getNetworkLogs } from "../browser.js";

export const checkCacheTool: ToolDefinition = {
  name: "check_cache",
  description:
    "Auditar headers de cache dos recursos carregados na página atual. Verifica Cache-Control, Expires, ETag, Last-Modified, e identifica recursos sem cache ou com cache muito curto.",
  args: {
    minCacheSeconds: z.string().optional().describe("Cache mínimo aceitável em segundos (padrão: 86400 = 1 dia)"),
  },
  async execute(args: { minCacheSeconds?: string }) {
    const networkLogs = getNetworkLogs();
    const minCache = parseInt(args.minCacheSeconds || "86400");

    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];
    const resources: Array<{
      url: string;
      type: string;
      status: number;
      cacheControl: string | null;
      expires: string | null;
      etag: string | null;
      lastModified: string | null;
      maxAge: number;
      isCacheable: boolean;
    }> = [];

    for (const req of networkLogs) {
      if (req.status >= 400) continue;
      const h = req.responseHeaders || {};
      const cc = h["cache-control"] || null;
      const expires = h["expires"] || null;
      const etag = h["etag"] || null;
      const lm = h["last-modified"] || null;

      let maxAge = -1;
      if (cc) {
        const m = cc.match(/max-age=(\d+)/i);
        if (m) maxAge = parseInt(m[1]);
        if (/no-cache|no-store|must-revalidate/i.test(cc) && !m) maxAge = 0;
      }
      if (maxAge < 0 && expires) {
        const expDate = new Date(expires).getTime();
        if (!isNaN(expDate)) {
          maxAge = Math.round((expDate - Date.now()) / 1000);
        }
      }

      const isCacheable = maxAge >= minCache;

      resources.push({
        url: req.url.length > 120 ? req.url.slice(0, 120) + "..." : req.url,
        type: req.type,
        status: req.status,
        cacheControl: cc,
        expires,
        etag,
        lastModified: lm,
        maxAge,
        isCacheable,
      });

      if (maxAge === 0 && req.type !== "document") {
        issues.push({ type: "cache", severity: "medium", message: `Recurso sem cache: ${req.url.slice(0, 80)}`, details: `Cache-Control: ${cc || "ausente"}, Tipo: ${req.type}` });
      } else if (maxAge > 0 && maxAge < minCache && req.type !== "document") {
        issues.push({ type: "cache", severity: "low", message: `Cache curto (${maxAge}s): ${req.url.slice(0, 80)}`, details: `Mínimo recomendado: ${minCache}s (${Math.round(minCache / 3600)}h)` });
      }
    }

    const cacheableCount = resources.filter((r) => r.isCacheable).length;
    const noCacheCount = resources.filter((r) => r.maxAge === 0 && r.type !== "document").length;

    console.error(`💾 Cache: ${cacheableCount}/${resources.length} resources cached ≥${minCache}s, ${noCacheCount} uncached`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        totalResources: resources.length,
        cacheableCount,
        noCacheCount,
        minCacheSeconds: minCache,
        resources: resources.slice(0, 100),
        issues,
      }, null, 2) }],
    };
  },
};

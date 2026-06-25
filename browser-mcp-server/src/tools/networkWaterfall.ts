import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs, clearNetworkLogs } from "../browser.js";

function categorizeDomain(domain: string): string {
  if (/google-analytics|googletagmanager|doubleclick/.test(domain)) return "analytics";
  if (/facebook|meta\./.test(domain)) return "social";
  if (/hotjar|fullstory|amplitude|mixpanel/.test(domain)) return "analytics";
  if (/cloudflare|akamai|fastly|cloudfront/.test(domain)) return "cdn";
  if (/gstatic|googleapis|jsdelivr|cdnjs|unpkg/.test(domain)) return "cdn";
  if (/googleads|adservice|adzerk/.test(domain)) return "advertising";
  if (/sentry|datadog|newrelic/.test(domain)) return "monitoring";
  return "other";
}

export const networkWaterfallTool: ToolDefinition = {
  name: "network_waterfall",
  description:
    "Analisar requisições de rede capturadas na página atual. Gera waterfall, análise de domínios terceiros, compressão, cache, render-blocking resources. Útil para diagnosticar performance.",
  args: {
    slowThreshold: z.string().optional().describe("Threshold TTFB em ms para considerar lento (padrão: 1000)"),
    clear: z.string().optional().describe("Se 'true', limpa o log de rede após análise"),
  },
  async execute(args: { slowThreshold?: string; clear?: string }) {
    const page = await getPage();
    const threshold = parseInt(args.slowThreshold || "1000", 10);
    console.error(`🌐 Network analysis: ${page.url()}`);

    const requests = getNetworkLogs();
    const allRequests = requests.filter((r) => r.status > 0);

    if (allRequests.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Nenhuma requisição de rede capturada. Navegue para uma página primeiro.",
          },
        ],
      };
    }

    const waterfall = allRequests
      .map((r) => ({
        url: r.url,
        method: r.method,
        status: r.status,
        type: r.type,
        size: r.transferSize || r.bodySize,
        time: Math.max(0, r.timing.responseEnd - r.timing.startTime) * 1000,
        ttfb: Math.max(0, r.timing.responseStart - r.timing.requestSent) * 1000,
      }))
      .sort((a, b) => b.time - a.time);

    const totalRequests = allRequests.length;
    const totalSize = allRequests.reduce((sum, r) => sum + (r.transferSize || r.bodySize), 0);
    const slowRequests = waterfall.filter((r) => r.ttfb > threshold).length;

    const thirdPartyDomains = new Map<
      string,
      { count: number; totalSize: number; totalTime: number }
    >();
    for (const r of allRequests) {
      if (!r.isThirdParty) continue;
      try {
        const domain = new URL(r.url).hostname;
        const entry = thirdPartyDomains.get(domain) || { count: 0, totalSize: 0, totalTime: 0 };
        entry.count++;
        entry.totalSize += r.transferSize || r.bodySize;
        entry.totalTime += Math.max(0, r.timing.responseEnd - r.timing.startTime) * 1000;
        thirdPartyDomains.set(domain, entry);
      } catch {}
    }

    const thirdParty = Array.from(thirdPartyDomains.entries()).map(([domain, data]) => ({
      domain,
      requestCount: data.count,
      totalSize: data.totalSize,
      avgTime: data.totalTime / data.count,
      category: categorizeDomain(domain),
    }));

    const compressible = allRequests.filter((r) => (r.transferSize || r.bodySize) >= 1000 && r.status > 0);
    const withCompression = compressible.filter((r) => {
      const ce = r.responseHeaders["content-encoding"] || "";
      return ce.includes("br") || ce.includes("gzip") || ce.includes("deflate");
    });
    const missingCompression = compressible.length - withCompression.length;

    const noCache = allRequests.filter((r) => {
      const cc = (r.responseHeaders["cache-control"] || "").toLowerCase();
      const expires = r.responseHeaders["expires"];
      return !cc && !expires;
    });

    const renderBlocking = allRequests.filter((r) => {
      return r.type === "script" || r.type === "stylesheet";
    });

    if (args.clear === "true") {
      clearNetworkLogs();
    }

    const result = {
      url: page.url(),
      totalRequests,
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(1),
      slowRequests,
      slowThreshold: threshold,
      thirdPartyRequests: thirdParty.length,
      thirdParty,
      compression: {
        enabled: withCompression.length,
        missing: missingCompression,
      },
      cache: {
        noCacheHeaders: noCache.length,
      },
      renderBlocking: renderBlocking.length,
      waterfall: waterfall.slice(0, 50),
      slowestRequests: waterfall.slice(0, 10),
    };

    console.error(`✅ ${totalRequests} requests, ${result.totalSizeKB}KB, ${slowRequests} lentas, ${missingCompression} sem compressão`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

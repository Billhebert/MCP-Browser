import { z } from "zod";
import type { ToolDefinition } from "../types.js";

interface SitemapUrl {
  loc: string;
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}

async function parseSitemapRecursive(url: string, depth: number, maxDepth: number, urls: SitemapUrl[], signal: AbortSignal): Promise<void> {
  if (depth > maxDepth) return;

  let xml: string;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return;
    xml = await res.text();
  } catch { return; }

  const sitemapIndex = /<sitemapindex/i.test(xml);
  if (sitemapIndex) {
    const locRe = /<loc[^>]*>([^<]+)<\/loc>/gi;
    let m: RegExpExecArray | null;
    const children: string[] = [];
    while ((m = locRe.exec(xml)) !== null) {
      if (m[1]) children.push(m[1].trim());
    }
    for (const child of children) {
      await parseSitemapRecursive(child, depth + 1, maxDepth, urls, signal);
    }
    return;
  }

  const urlRe = /<url>([\s\S]*?)<\/url>/gi;
  let u: RegExpExecArray | null;
  while ((u = urlRe.exec(xml)) !== null) {
    const block = u[1];
    const loc = block.match(/<loc[^>]*>([^<]+)<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = block.match(/<lastmod[^>]*>([^<]+)<\/lastmod>/i)?.[1]?.trim() || null;
    const changefreq = block.match(/<changefreq[^>]*>([^<]+)<\/changefreq>/i)?.[1]?.trim() || null;
    const priority = block.match(/<priority[^>]*>([^<]+)<\/priority>/i)?.[1]?.trim() || null;
    urls.push({
      loc,
      lastmod,
      changefreq,
      priority: priority ? parseFloat(priority) : null,
    });
  }
}

export const scrapeSitemapTool: ToolDefinition = {
  name: "scrape_sitemap",
  description: "Extrai todas as URLs de um sitemap.xml, incluindo sitemaps aninhados (sitemap index). Retorna lista completa com lastmod, changefreq, priority e estatísticas do sitemap.",
  args: {
    url: z.string().max(5000).optional().describe("URL do sitemap.xml. Se not fornecido, tenta /sitemap.xml do domínio current"),
    domain: z.string().max(500).optional().describe("Domínio para search sitemap (ex: https://exemplo.with). Usado only se url not for fornecida"),
    maxDepth: z.string().max(10).optional().describe("depth máxima para sitemap index aninhado (default: 3)"),
    timeout: z.string().max(10).optional().describe("Timeout em ms (default: 15000)"),
  },
  async execute(args: { url?: string; domain?: string; maxDepth?: string; timeout?: string }) {
    const maxDepth = parseInt(args.maxDepth || "3");
    const timeout = parseInt(args.timeout || "15000");

    let sitemapUrl: string;
    if (args.url) {
      sitemapUrl = args.url;
    } else if (args.domain) {
      sitemapUrl = new URL("/sitemap.xml", args.domain).href;
    } else {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Forneça url ou domain" }) }],
        isError: true,
      };
    }

    console.error(`🗺️ Scraping sitemap: ${sitemapUrl}`);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    try {
      const urls: SitemapUrl[] = [];
      await parseSitemapRecursive(sitemapUrl, 0, maxDepth, urls, ac.signal);

      const domains = new Map<string, number>();
      const extensions = new Map<string, number>();
      for (const u of urls) {
        try {
          const host = new URL(u.loc).hostname;
          domains.set(host, (domains.get(host) || 0) + 1);
          const ext = u.loc.split(".").pop()?.split("/")[0]?.toLowerCase() || "unknown";
          extensions.set(ext, (extensions.get(ext) || 0) + 1);
        } catch {}
      }

      console.error(`✅ Sitemap: ${urls.length} URLs encontradas`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sitemapUrl,
              totalUrls: urls.length,
              stats: {
                domains: Object.fromEntries(domains),
                extensions: Object.fromEntries(extensions),
                withLastmod: urls.filter((u) => u.lastmod).length,
                withPriority: urls.filter((u) => u.priority !== null).length,
                withChangefreq: urls.filter((u) => u.changefreq).length,
              },
              urls: urls.map((u) => ({
                loc: u.loc,
                ...(u.lastmod ? { lastmod: u.lastmod } : {}),
                ...(u.changefreq ? { changefreq: u.changefreq } : {}),
                ...(u.priority !== null ? { priority: u.priority } : {}),
              })),
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Falha ao acessar sitemap: ${(err as Error).message}` }) }],
        isError: true,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

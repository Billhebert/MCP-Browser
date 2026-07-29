import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getContext } from "../browser.js";
import { isSafeUrl } from "../corporate/ssrf.js";

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.pathname = u.pathname.replace(/\/index\.html$|\/index\.htm$|\/default\.aspx$/i, "/").replace(/\/+$/, "") || "/";
    return u.href;
  } catch {
    return raw;
  }
}

function isSameDomain(url: string, base: string): boolean {
  try {
    return new URL(url).hostname === new URL(base).hostname;
  } catch {
    return false;
  }
}

function matchesExclude(url: string, patterns: string[]): boolean {
  return patterns.some((p) => url.includes(p));
}

function matchesInclude(url: string, patterns: string[]): boolean {
  if (!patterns.length) return true;
  return patterns.some((p) => url.includes(p));
}

async function fetchSitemapXml(url: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const urlCheck = isSafeUrl(url);
    if (!urlCheck.safe) return [];

    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls: string[] = [];
    const locRe = /<loc[^>]*>([^<]+)<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = locRe.exec(xml)) !== null) {
      if (m[1]) urls.push(m[1].trim());
    }
    return urls;
  } catch {
    return [];
  }
}

export const crawlPagesTool: ToolDefinition = {
  name: "crawl_pages",
  description: "Discover URLs from a site using sitemap, robots.txt, and live crawling.",
  args: {
    url: z.string().max(5000).optional().describe("Starting URL. Default: current page"),
    maxDepth: z.number().int().positive().optional().describe("Maximum crawl depth. Default: 2"),
    maxPages: z.number().int().positive().optional().describe("Maximum pages to visit. Default: 10"),
    exclude: z.string().max(100).optional().describe("URL patterns to exclude (withma separated)"),
    include: z.string().max(100).optional().describe("URL patterns to include (withma separated)"),
    sitemap: z.boolean().optional().describe("Use sitemap.xml. Default: true"),
  },
  async execute(args: {
    url?: string;
    maxDepth?: number;
    maxPages?: number;
    exclude?: string;
    include?: string;
    sitemap?: boolean;
  }) {
    const ctx = await getContext();
    const startUrl = args.url || ctx.pages()[0]?.url();
    if (!startUrl) {
      return {
        content: [{ type: "text", text: "Navegue para uma página primeiro ou forneça uma URL." }],
        isError: true,
      };
    }

    const maxDepth = args.maxDepth || 2;
    const maxPages = args.maxPages || 10;
    const exclude = args.exclude ? args.exclude.split(",").map((s) => s.trim()) : [];
    const include = args.include ? args.include.split(",").map((s) => s.trim()) : [];
    const useSitemap = args.sitemap !== false;

    console.error(`🕷 Crawl: ${startUrl} (max ${maxPages} pages, depth ${maxDepth})`);

    const discovered = new Set<string>();
    let source: "sitemap" | "live" | "manual" = "manual";

    if (useSitemap) {
      console.error(`  Checking sitemap.xml...`);
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 10000);
      try {
        const sitemapUrl = new URL("/sitemap.xml", startUrl).href;
        const urls = await fetchSitemapXml(sitemapUrl, ac.signal);
        for (const u of urls) {
          const n = normalizeUrl(u);
          if (isSameDomain(n, startUrl) && matchesInclude(n, include) && !matchesExclude(n, exclude)) {
            discovered.add(n);
          }
        }
        if (discovered.size > 0) source = "sitemap";
        console.error(`  Sitemap: ${discovered.size} URLs`);
      } finally {
        clearTimeout(timeout);
      }
    }

    if (discovered.size < maxPages) {
      console.error(`  Crawling ao vivo...`);
      const visited = new Set<string>();
      const queue: Array<{ url: string; depth: number }> = [{ url: normalizeUrl(startUrl), depth: 0 }];

      while (queue.length > 0 && visited.size < maxPages) {
        const item = queue.shift()!;
        if (visited.has(item.url) || matchesExclude(item.url, exclude)) continue;
        if (!matchesInclude(item.url, include)) continue;

        try {
          const page = await ctx.newPage();
          await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 15000 });
          const title = await page.title().catch(() => "");
          visited.add(item.url);
          discovered.add(item.url);
          console.error(`  [${visited.size}/${maxPages}] ${item.url} — ${title.slice(0, 60)}`);

          if (item.depth < maxDepth) {
            const links: string[] = await page.evaluate(() =>
              Array.from(document.querySelectorAll("a[href]"))
                .map((a) => (a as HTMLAnchorElement).href)
                .filter((h) => h.startsWith("http://") || h.startsWith("https://")),
            );
            for (const link of links) {
              const n = normalizeUrl(link);
              if (isSameDomain(n, startUrl) && !visited.has(n) && !discovered.has(n) && discovered.size < maxPages) {
                queue.push({ url: n, depth: item.depth + 1 });
              }
            }
          }

          await page.close();
        } catch (err: any) {
          console.error(`  ⚠️ ${item.url}: ${err.message}`);
          visited.add(item.url);
        }
      }

      source = "live";
      console.error(`  Live: ${visited.size} pages visitadas`);
    }

    const urls = Array.from(discovered);
    console.error(`✅ Crawl: ${urls.length} URLs descobertas (${source})`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ urls, total: urls.length, source }, null, 2),
        },
      ],
    };
  },
};

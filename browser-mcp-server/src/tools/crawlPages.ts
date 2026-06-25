import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getContext } from "../browser.js";

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
  description:
    "Descobrir e navegar por URLs de um site. Primeiro tenta sitemap.xml, depois robots.txt, depois crawling ao vivo (segue links). Usa abas do navegador atual. Útil para mapear o site que você está navegando.",
  args: {
    url: z.string().optional().describe("URL para começar o crawl (padrão: URL atual)"),
    maxDepth: z.string().optional().describe("Profundidade máxima de navegação (padrão: 2)"),
    maxPages: z.string().optional().describe("Número máximo de páginas para visitar (padrão: 10)"),
    exclude: z.string().optional().describe("Padrões de URL para excluir (separados por vírgula)"),
    include: z.string().optional().describe("Padrões de URL para incluir (separados por vírgula)"),
    sitemap: z.string().optional().describe("Se 'false', pula sitemap.xml (padrão: true)"),
  },
  async execute(args: {
    url?: string;
    maxDepth?: string;
    maxPages?: string;
    exclude?: string;
    include?: string;
    sitemap?: string;
  }) {
    const ctx = await getContext();
    const startUrl = args.url || ctx.pages()[0]?.url();
    if (!startUrl) {
      return {
        content: [{ type: "text", text: "Navegue para uma página primeiro ou forneça uma URL." }],
        isError: true,
      };
    }

    const maxDepth = parseInt(args.maxDepth || "2", 10);
    const maxPages = parseInt(args.maxPages || "10", 10);
    const exclude = args.exclude ? args.exclude.split(",").map((s) => s.trim()) : [];
    const include = args.include ? args.include.split(",").map((s) => s.trim()) : [];
    const useSitemap = args.sitemap !== "false";

    console.error(`🕷 Crawl: ${startUrl} (max ${maxPages} páginas, profundidade ${maxDepth})`);

    const discovered = new Set<string>();
    let source: "sitemap" | "live" | "manual" = "manual";

    if (useSitemap) {
      console.error(`  Verificando sitemap.xml...`);
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
      console.error(`  Live: ${visited.size} páginas visitadas`);
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

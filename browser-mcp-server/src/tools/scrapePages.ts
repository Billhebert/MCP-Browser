import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getContext } from "../browser.js";
import { isSafeUrl } from "../corporate/ssrf.js";

export const scrapePagesTool: ToolDefinition = {
  name: "scrape_pages",
  description: "Crawl múltiplas pages com extratores configuráveis (seletores CSS, XPath). Extrai dados estruturados de cada página e retorna como array de objetos. Ideal para web scraping, coleta de dados, e migração de conteúdo.",
  args: {
    startUrl: z.string().max(5000).describe("URL inicial para witheçar o crawl"),
    selectors: z.string().max(5000).describe("JSON com extratores: {\"titulo\":\"h1\",\"descricao\":\"meta[name=description]\",\"preco\":\".price\",\"imagens\":\"img[src]\"}"),
    maxPages: z.string().max(10).optional().describe("Máximo de pages (default: 20)"),
    sameDomain: z.string().max(10).optional().describe("Apenas mesmo domínio? 'true' ou 'false' (padrão: 'true')"),
    depth: z.string().max(10).optional().describe("depth máxima de crawl (default: 1)"),
    exclude: z.string().max(500).optional().describe("Padrões de URL para exclude (separated por vírgula)"),
  },
  async execute(args: { startUrl: string; selectors: string; maxPages?: string; sameDomain?: string; depth?: string; exclude?: string }) {
    const startUrl = args.startUrl;
    const selectors: Record<string, string> = JSON.parse(args.selectors);
    const maxPages = parseInt(args.maxPages || "20");
    const sameDomain = args.sameDomain !== "false";
    const maxDepth = parseInt(args.depth || "1");
    const exclude = args.exclude ? args.exclude.split(",").map((s) => s.trim()) : [];

    const baseHost = new URL(startUrl).hostname;

    const ctx = await getContext();
    const visited = new Set<string>();
    const results: Array<{ url: string; data: Record<string, any>; error?: string }> = [];
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

    while (queue.length > 0 && visited.size < maxPages) {
      const item = queue.shift()!;
      const normalized = item.url.split("#")[0];
      if (visited.has(normalized)) continue;
      if (exclude.some((p) => normalized.includes(p))) continue;

      const safeCheck = isSafeUrl(normalized);
      if (!safeCheck.safe) {
        console.error(`⚠️ URL bloqueada: ${safeCheck.reason}`);
        visited.add(normalized);
        continue;
      }

      try {
        console.error(`🕷️ Scraping: ${normalized}`);
        const page = await ctx.newPage();
        await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(500);
        visited.add(normalized);

        const extracted: Record<string, any> = {};
        for (const [key, selector] of Object.entries(selectors)) {
          try {
            if (selector.startsWith("//") || selector.startsWith("./")) {
              const parts = await page.evaluate((sel) => {
                const iterator = document.evaluate(sel, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                const items: string[] = [];
                for (let i = 0; i < iterator.snapshotLength; i++) {
                  const node = iterator.snapshotItem(i);
                  items.push(node?.textContent?.trim() || (node as any)?.src || "");
                }
                return items;
              }, selector);
              extracted[key] = parts.length === 1 ? parts[0] : parts;
            } else if (selector.includes("[src]") || selector.includes("[href]")) {
              const attrs = await page.evaluate((sel) => {
                const els = Array.from(document.querySelectorAll(sel));
                return els.map((el) => (el as any).src || (el as any).href || el.getAttribute("src") || el.getAttribute("href") || "");
              }, selector);
              extracted[key] = attrs.length === 1 ? attrs[0] : attrs;
            } else if (selector.startsWith("meta[")) {
              const content = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el?.getAttribute("content") || null;
              }, selector);
              extracted[key] = content;
            } else {
              const texts = await page.evaluate((sel) => {
                const els = Array.from(document.querySelectorAll(sel));
                return els.map((el) => (el as HTMLElement).innerText || el.textContent || "").map((t) => t.trim()).filter(Boolean);
              }, selector);
              extracted[key] = texts.length === 1 ? texts[0] : texts;
            }
          } catch (err) {
            extracted[key] = null;
          }
        }

        results.push({ url: normalized, data: extracted });

        if (item.depth < maxDepth) {
          const links = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a[href]"))
              .map((a) => (a as HTMLAnchorElement).href)
              .filter((h) => h.startsWith("http://") || h.startsWith("https://"))
          );
          for (const link of links) {
            const n = link.split("#")[0];
            if (visited.has(n) || results.length + queue.length >= maxPages) continue;
            if (sameDomain && !new URL(link).hostname.includes(baseHost)) continue;
            if (exclude.some((p) => n.includes(p))) continue;
            queue.push({ url: n, depth: item.depth + 1 });
          }
        }

        await page.close();
      } catch (err) {
        visited.add(normalized);
        results.push({ url: normalized, data: {}, error: (err as Error).message });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            startUrl,
            pagesScraped: results.length,
            totalFound: visited.size,
            fields: Object.keys(selectors),
            data: results,
            stats: {
              successCount: results.filter((r) => !r.error).length,
              errorCount: results.filter((r) => r.error).length,
            },
          }, null, 2),
        },
      ],
    };
  },
};

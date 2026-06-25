import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const exportPageDataTool: ToolDefinition = {
  name: "export_page_data",
  description:
    "Exportar dados estruturados completos da página atual: metadados (<title>, <meta>), dados estruturados (JSON-LD, microdata), imagens (src, alt, dimensões), links internos/externos, e informações de rede. Retorna bundle JSON completo.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const networkLogs = getNetworkLogs();

    const data = await page.evaluate(() => {
      const title = document.title;
      const metas: Record<string, string> = {};
      for (const meta of Array.from(document.querySelectorAll("meta"))) {
        const name = meta.getAttribute("name") || meta.getAttribute("property") || "";
        const content = meta.getAttribute("content") || "";
        if (name && content) metas[name] = content;
      }

      const jsonld: Array<Record<string, unknown>> = [];
      for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
        try { jsonld.push(JSON.parse(script.textContent || "") as Record<string, unknown>); } catch {}
      }

      const images = Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt || "",
        width: img.naturalWidth || img.clientWidth,
        height: img.naturalHeight || img.clientHeight,
        loading: img.loading,
      }));

      const links = Array.from(document.querySelectorAll("a[href]")).map((a) => {
        const href = (a as HTMLAnchorElement).href;
        const isInternal = href.startsWith(window.location.origin) || href.startsWith("/") || href.startsWith("#");
        return {
          href: href.slice(0, 200),
          text: (a.textContent || "").trim().slice(0, 60),
          isInternal,
          rel: (a as HTMLAnchorElement).rel || "",
        };
      });

      const headings: Record<string, string[]> = {};
      for (const h of Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
        const tag = h.tagName.toLowerCase();
        if (!headings[tag]) headings[tag] = [];
        headings[tag].push((h.textContent || "").trim().slice(0, 80));
      }

      const language = document.documentElement.lang || "";
      const charset = document.characterSet || "";
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";

      return { title, metas, jsonld, images, links, headings, language, charset, canonical };
    });

    const networkSummary = {
      totalRequests: networkLogs.length,
      totalSizeKB: Math.round(networkLogs.reduce((s, r) => s + r.transferSize, 0) / 1024),
      byType: Object.entries(
        networkLogs.reduce((acc: Record<string, { count: number; size: number }>, r) => {
          const t = r.type || "unknown";
          if (!acc[t]) acc[t] = { count: 0, size: 0 };
          acc[t].count++;
          acc[t].size += r.transferSize;
          return acc;
        }, {}),
      ).map(([type, info]) => ({ type, count: info.count, sizeKB: Math.round(info.size / 1024) })),
    };

    console.error(`📦 Page data exported: ${data.title}, ${data.images.length} images, ${data.links.length} links, ${data.jsonld.length} JSON-LD`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ url, metadata: data, network: networkSummary }, null, 2),
      }],
    };
  },
};

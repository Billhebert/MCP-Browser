import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

interface SeoPageData {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  hreflangs: Array<{ hreflang: string; href: string }>;
  jsonLd: any[];
  headings: Array<{ level: number; text: string }>;
  images: Array<{ src: string; alt: string | null; isDecorative: boolean }>;
  links: Array<{ href: string; rel: string | null; isInternal: boolean; isNofollow: boolean }>;
  robotsMeta: string | null;
  viewport: string | null;
  wordCount: number;
  hasMain: boolean;
  hasArticle: boolean;
}

async function extractSeoData(page: any): Promise<SeoPageData> {
  return page.evaluate(() => {
    const baseUrl = window.location.origin;
    const getMeta = (name: string, attr = "name"): string | null => {
      const el = document.querySelector(`meta[${attr}="${name}"]`);
      return el ? el.getAttribute("content") : null;
    };
    const getMetas = (prefix: string, attr = "property"): Record<string, string> => {
      const result: Record<string, string> = {};
      document.querySelectorAll(`meta[${attr}^="${prefix}"]`).forEach((el) => {
        const prop = el.getAttribute(attr) || "";
        result[prop] = el.getAttribute("content") || "";
      });
      return result;
    };
    const title = document.title || null;
    const metaDescription = getMeta("description");
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || null;
    const ogTags = getMetas("og:", "property");
    const twitterTags = getMetas("twitter:", "name");
    const hreflangs = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map((el) => ({
      hreflang: el.getAttribute("hreflang") || "",
      href: el.getAttribute("href") || "",
    }));
    const jsonLd: any[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
      try {
        jsonLd.push(JSON.parse(el.textContent || "{}"));
      } catch {}
    });
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
      level: parseInt(h.tagName[1]!, 10),
      text: (h.textContent || "").trim().slice(0, 100),
    }));
    const images = Array.from(document.querySelectorAll("img[src]")).map((img) => ({
      src: (img as HTMLImageElement).src || img.getAttribute("src") || "",
      alt: img.getAttribute("alt"),
      isDecorative:
        img.getAttribute("role") === "presentation" ||
        img.getAttribute("aria-hidden") === "true",
    }));
    const links = Array.from(document.querySelectorAll("a[href]")).map((a) => {
      const href = (a as HTMLAnchorElement).href || a.getAttribute("href") || "";
      const rel = a.getAttribute("rel");
      const isInternal =
        href.startsWith(baseUrl) ||
        href.startsWith("/") ||
        href.startsWith("#") ||
        href.startsWith("?");
      const isNofollow = rel ? rel.split(/\s+/).includes("nofollow") : false;
      return { href, rel, isInternal, isNofollow };
    });
    const robotsMeta = getMeta("robots");
    const viewport = getMeta("viewport", "name");
    const textContent = (document.body?.textContent || "").trim();
    const wordCount = textContent ? textContent.split(/\s+/).length : 0;
    return {
      title,
      titleLength: title ? title.length : 0,
      metaDescription,
      metaDescriptionLength: metaDescription ? metaDescription.length : 0,
      canonical,
      ogTags,
      twitterTags,
      hreflangs,
      jsonLd,
      headings,
      images,
      links,
      robotsMeta,
      viewport,
      wordCount,
      hasMain: document.querySelectorAll("main, [role='main']").length > 0,
      hasArticle: document.querySelectorAll("article, [role='article']").length > 0,
    };
  });
}

export const analyzeSeoTool: ToolDefinition = {
  name: "analyze_seo",
  description:
    "Analisar SEO da página atual: title, meta description, canonical, Open Graph, Twitter Cards, hreflang, JSON-LD, headings, imagens, links, robots, viewport. Retorna score 0-100 com issues.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    console.error(`📈 SEO audit: ${url}`);

    const data = await extractSeoData(page);
    const issues: Array<{ type: string; severity: string; message: string }> = [];

    if (!data.title) {
      issues.push({ type: "title", severity: "high", message: "Missing <title> tag" });
    } else {
      if (data.titleLength < 10) issues.push({ type: "title", severity: "medium", message: `Title muito curto (${data.titleLength} chars): "${data.title}"` });
      else if (data.titleLength > 60) issues.push({ type: "title", severity: "medium", message: `Title muito longo (${data.titleLength} chars, max 60 para SERP)` });
      if (data.title === data.metaDescription) issues.push({ type: "title", severity: "medium", message: "Title e meta description idênticos" });
    }

    if (!data.metaDescription) {
      issues.push({ type: "description", severity: "high", message: "Missing meta description" });
    } else {
      if (data.metaDescriptionLength < 50) issues.push({ type: "description", severity: "medium", message: `Meta description muito curta (${data.metaDescriptionLength} chars)` });
      else if (data.metaDescriptionLength > 160) issues.push({ type: "description", severity: "low", message: `Meta description muito longa (${data.metaDescriptionLength} chars, max 160)` });
    }

    if (!data.canonical) {
      issues.push({ type: "canonical", severity: "medium", message: "Missing canonical link" });
    } else {
      try {
        const canonicalUrl = new URL(data.canonical, url);
        const pageUrl = new URL(url);
        if (canonicalUrl.hostname !== pageUrl.hostname) {
          issues.push({ type: "canonical", severity: "high", message: `Canonical aponta para domínio diferente: ${data.canonical}` });
        }
      } catch {
        issues.push({ type: "canonical", severity: "high", message: `Canonical URL inválida: ${data.canonical}` });
      }
    }

    const ogRequired = ["og:title", "og:description", "og:type", "og:url"];
    for (const tag of ogRequired) {
      if (!data.ogTags[tag]) issues.push({ type: "og", severity: "low", message: `Missing ${tag}` });
    }
    if (!data.ogTags["og:image"]) issues.push({ type: "og", severity: "low", message: "Missing og:image (recomendado para compartilhamento social)" });
    if (data.ogTags["og:title"] && data.ogTags["og:title"] === data.title) {
      issues.push({ type: "og", severity: "low", message: "og:title idêntico ao <title>" });
    }

    if (!data.twitterTags["twitter:card"]) issues.push({ type: "twitter", severity: "low", message: "Missing twitter:card" });
    if (!data.twitterTags["twitter:title"]) issues.push({ type: "twitter", severity: "low", message: "Missing twitter:title" });
    if (!data.twitterTags["twitter:description"]) issues.push({ type: "twitter", severity: "low", message: "Missing twitter:description" });

    if (data.hreflangs.length > 0) {
      const langs = data.hreflangs.map((h) => h.hreflang);
      if (!langs.includes("x-default")) issues.push({ type: "hreflang", severity: "low", message: "hreflang sem x-default fallback" });
      const langCount: Record<string, number> = {};
      for (const lang of langs) langCount[lang] = (langCount[lang] || 0) + 1;
      for (const [lang, count] of Object.entries(langCount)) {
        if (count > 1) issues.push({ type: "hreflang", severity: "high", message: `hreflang duplicado: ${lang} (${count} ocorrências)` });
      }
    }

    if (data.jsonLd.length === 0) {
      issues.push({ type: "structured-data", severity: "low", message: "Nenhum JSON-LD encontrado" });
    } else {
      for (const sd of data.jsonLd) {
        if (!sd["@context"]) issues.push({ type: "structured-data", severity: "medium", message: "JSON-LD sem @context" });
        if (!sd["@type"]) issues.push({ type: "structured-data", severity: "medium", message: "JSON-LD sem @type" });
      }
    }

    const h1s = data.headings.filter((h) => h.level === 1);
    if (h1s.length === 0) {
      issues.push({ type: "headings", severity: "high", message: "Página sem h1" });
    } else if (h1s.length > 1) {
      issues.push({ type: "headings", severity: "medium", message: `${h1s.length} h1 na página (recomenda-se apenas um)` });
    }

    let maxLevel = 0;
    for (const h of data.headings) {
      if (h.level > maxLevel + 1) {
        issues.push({ type: "headings", severity: "medium", message: `Pulo de heading: h${maxLevel || 0} para h${h.level}` });
        break;
      }
      maxLevel = Math.max(maxLevel, h.level);
    }

    const missingAlt = data.images.filter((img) => !img.alt && !img.isDecorative);
    if (missingAlt.length > 0) {
      issues.push({ type: "images", severity: "high", message: `${missingAlt.length} imagem(ns) sem alt text` });
    }
    const genericAlt = data.images.filter((img) =>
      img.alt && ["image", "photo", "picture", "img", "banner"].includes(img.alt.toLowerCase().trim())
    );
    if (genericAlt.length > 0) {
      issues.push({ type: "images", severity: "low", message: `${genericAlt.length} imagem(ns) com alt genérico` });
    }

    const internalLinks = data.links.filter((l) => l.isInternal && !l.href.startsWith("#") && !l.href.startsWith("?"));
    if (internalLinks.length === 0 && data.links.length > 0) {
      issues.push({ type: "links", severity: "medium", message: "Nenhum link interno encontrado" });
    }

    if (data.robotsMeta) {
      if (/noindex/i.test(data.robotsMeta)) issues.push({ type: "robots", severity: "high", message: "Página com noindex (não será indexada)" });
      if (/nofollow/i.test(data.robotsMeta)) issues.push({ type: "robots", severity: "medium", message: "Página com nofollow" });
    }

    if (data.wordCount < 300) {
      issues.push({ type: "content", severity: "medium", message: `Conteúdo fino: apenas ${data.wordCount} palavras (recomendado >300)` });
    }

    if (!data.viewport) {
      issues.push({ type: "viewport", severity: "high", message: "Missing viewport meta tag" });
    }

    const severityScores: Record<string, number> = { high: 15, medium: 8, low: 3 };
    let score = 100;
    for (const issue of issues) {
      score -= severityScores[issue.severity] ?? 5;
    }
    score = Math.max(0, Math.min(100, score));

    console.error(`✅ SEO: score ${score} (${issues.length} issues)`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ url, score, issues, data }, null, 2),
        },
      ],
    };
  },
};

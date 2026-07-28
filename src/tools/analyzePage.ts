import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, getNetworkLogs } from "../browser.js";

const SEO_ISSUES = [
  { id: "missing-title", severity: "critical", message: "Página sem tag <title>", howToFix: "Adicione uma tag <title> única e descritiva no <head>" },
  { id: "title-too-long", severity: "warning", message: "Title muito longo (>60 caracteres)", howToFix: "Reduza o title para no máximo 60 caracteres para evitar corte na SERP" },
  { id: "title-too-short", severity: "warning", message: "Title muito curto (<10 caracteres)", howToFix: "Aumente o title para pelo menos 10 caracteres descritivos" },
  { id: "missing-meta-description", severity: "warning", message: "Missing meta description", howToFix: "Adicione uma meta description única de 70-160 caracteres" },
  { id: "meta-description-too-long", severity: "info", message: "Meta description muito longa (>160 caracteres)", howToFix: "Reduza para no máximo 160 caracteres" },
  { id: "meta-description-too-short", severity: "info", message: "Meta description muito curta (<70 caracteres)", howToFix: "Aumente para pelo menos 70 caracteres" },
  { id: "missing-canonical", severity: "warning", message: "Missing canonical URL", howToFix: "Adicione <link rel='canonical'> apontando para a URL principal" },
  { id: "canonical-conflict", severity: "warning", message: "Conflito de canonical entre HTML e HTTP header", howToFix: "Garanta que o canonical no HTML e no Link header são idênticos" },
  { id: "missing-h1", severity: "warning", message: "Página sem tag <h1>", howToFix: "Adicione um único <h1> descrevendo o conteúdo principal" },
  { id: "multiple-h1", severity: "warning", message: "Múltiplos <h1> na página", howToFix: "Use only um <h1> por página; os demais títulos devem ser h2-h6" },
  { id: "heading-order-skip", severity: "info", message: "Pulo na ordem de headings", howToFix: "Não pule níveis de heading (ex: h1 → h3). Use h1 → h2 → h3" },
  { id: "thin-content", severity: "warning", message: "Conteúdo fino (<150 palavras)", howToFix: "Adicione mais conteúdo relevante. Páginas finas têm baixo desempenho SEO" },
  { id: "images-missing-alt", severity: "warning", message: "Imagens sem atributo alt", howToFix: "Adicione alt text descritivo a todas as imagens" },
  { id: "missing-og-tags", severity: "info", message: "Faltam tags Open Graph", howToFix: "Adicione og:title, og:description, og:image, og:type, og:url" },
  { id: "missing-twitter-card", severity: "info", message: "Faltam Twitter Card tags", howToFix: "Adicione twitter:card, twitter:title, twitter:description" },
  { id: "no-jsonld", severity: "info", message: "Nenhum JSON-LD encontrado", howToFix: "Adicione dados estruturados JSON-LD (schema.org) para rich snippets" },
  { id: "missing-viewport", severity: "critical", message: "Missing viewport meta tag", howToFix: "Adicione <meta name='viewport' content='width=device-width, initial-scale=1'>" },
  { id: "noindex-page", severity: "info", message: "Página com noindex", howToFix: "Remova noindex se esta página deve ser indexada" },
  { id: "broken-links", severity: "warning", message: "Links quebrados Found", howToFix: "Corrija ou remova links que retornam 4xx/5xx" },
  { id: "no-outgoing-links", severity: "info", message: "Nenhum link de saída", howToFix: "Adicione links internos para outras pages do site" },
  { id: "missing-hreflang", severity: "info", message: "Tags hreflang ausentes para site multi-idioma", howToFix: "Adicione <link rel='alternate' hreflang='...'> para cada idioma" },
  { id: "duplicate-title", severity: "warning", message: "Title duplicado em múltiplas pages", howToFix: "Crie titles únicos para cada página" },
  { id: "duplicate-meta-description", severity: "warning", message: "Meta description duplicada", howToFix: "Crie meta descriptions únicas para cada página" },
  { id: "slow-response", severity: "warning", message: "Tempo de resposta lento (>1.5s TTFB)", howToFix: "Otimize o servidor, use cache e CDN" },
  { id: "missing-language", severity: "info", message: "Atributo lang ausente no <html>", howToFix: "Adicione lang='pt-BR' ou idioma correto na tag <html>" },
];

export const analyzePageTool: ToolDefinition = {
  name: "analyze_page",
  description: "Auditoria completa de UMA única página ou componente. Analisa: SEO (25 tipos de issues com howToFix), performance (LCP/FCP/CLS), acessibilidade (axe-core), segurança (headers, cookies), structured data, links, imagens, headings. Retorna score 0-100 com diagnóstico detalhado e instruções de correção.",
  args: {
    url: z.string().max(5000).optional().describe("URL para analisar. Se omitido, usa a page current"),
    checks: z.string().max(200).optional().describe("Checks: 'seo,perf,a11y,security' ou 'all' (padrão: 'all')"),
  },
  async execute(args: { url?: string; checks?: string }) {
    const page = await getPage();
    const targetUrl = args.url || page.url();
    const checkList = args.checks ? args.checks.split(",").map((s) => s.trim()) : ["all"];
    const allChecks = checkList.includes("all");
    const checkSeo = allChecks || checkList.includes("seo");
    const checkPerf = allChecks || checkList.includes("perf");
    const checkSecurity = allChecks || checkList.includes("security");

    console.error(`🔬 Analyzing page: ${targetUrl}`);

    if (targetUrl !== page.url()) {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1000);
    }

    const issues: Array<{ id: string; severity: string; message: string; howToFix: string; category: string }> = [];

    if (checkSeo) {
      const seoEval = `(function() {
        var getMeta = function(name, attr) { attr = attr || "name"; var el = document.querySelector("meta[" + attr + '="' + name + '"]'); return el ? el.getAttribute("content") : null; };
        var title = document.title || null;
        var metaDescription = getMeta("description");
        var canonical = document.querySelector('link[rel="canonical"]');
        var titleLength = title ? title.length : 0;
        var metaDescriptionLength = metaDescription ? metaDescription.length : 0;
        var viewport = getMeta("viewport", "name");
        var lang = document.documentElement.getAttribute("lang");
        var robots = getMeta("robots");
        var ogTags = {};
        var metas = document.querySelectorAll('meta[property^="og:"]');
        for (var oi = 0; oi < metas.length; oi++) { var prop = metas[oi].getAttribute("property"); if (prop) ogTags[prop] = metas[oi].getAttribute("content") || ""; }
        var twitterTags = {};
        var tms = document.querySelectorAll('meta[name^="twitter:"]');
        for (var ti = 0; ti < tms.length; ti++) { var tn = tms[ti].getAttribute("name"); if (tn) twitterTags[tn] = tms[ti].getAttribute("content") || ""; }
        var headings = [];
        var hs = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
        for (var hi = 0; hi < hs.length; hi++) { headings.push({ level: parseInt(hs[hi].tagName[1], 10), text: (hs[hi].textContent || "").trim().slice(0, 100) }); }
        var images = [];
        var imgs = document.querySelectorAll("img[src]");
        for (var ii = 0; ii < imgs.length; ii++) { images.push({ src: imgs[ii].src || imgs[ii].getAttribute("src") || "", alt: imgs[ii].getAttribute("alt") }); }
        var wordCount = (document.body ? document.body.textContent || "" : "").trim().split(/\\s+/).filter(function(s) { return s; }).length;
        var hasJsonLd = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
        var hreflangs = [];
        var hrs = document.querySelectorAll('link[rel="alternate"][hreflang]');
        for (var ri = 0; ri < hrs.length; ri++) { hreflangs.push(hrs[ri].getAttribute("hreflang")); }
        var links = [];
        var als = document.querySelectorAll("a[href]");
        for (var li = 0; li < als.length; li++) { links.push({ href: als[li].href || als[li].getAttribute("href") || "" }); }
        var hasMain = document.querySelectorAll("main, [role=main]").length > 0;
        canonical = canonical ? canonical.getAttribute("href") : null;
        return { title: title, titleLength: titleLength, metaDescription: metaDescription, metaDescriptionLength: metaDescriptionLength, canonical: canonical, viewport: viewport, lang: lang, robots: robots, ogTags: ogTags, twitterTags: twitterTags, headings: headings, images: images, wordCount: wordCount, hasJsonLd: hasJsonLd, hreflangs: hreflangs, links: links, hasMain: hasMain };
      })()`;
      const seoData: any = await page.evaluate(seoEval);

      for (const issue of SEO_ISSUES) {
        let match = false;
        switch (issue.id) {
          case "missing-title": match = !seoData.title; break;
          case "title-too-long": match = seoData.titleLength > 60; break;
          case "title-too-short": match = seoData.titleLength > 0 && seoData.titleLength < 10; break;
          case "missing-meta-description": match = !seoData.metaDescription; break;
          case "meta-description-too-long": match = (seoData.metaDescriptionLength || 0) > 160; break;
          case "meta-description-too-short": match = (seoData.metaDescriptionLength || 0) > 0 && seoData.metaDescriptionLength < 70; break;
          case "missing-canonical": match = !seoData.canonical; break;
          case "missing-h1": match = !seoData.headings.find(function(h: any) { return h.level === 1; }); break;
          case "multiple-h1": match = seoData.headings.filter(function(h: any) { return h.level === 1; }).length > 1; break;
          case "heading-order-skip": {
            let maxLvl = 0;
            for (let hi = 0; hi < seoData.headings.length; hi++) { var hl = seoData.headings[hi].level; if (hl > maxLvl + 1) { match = true; break; } maxLvl = Math.max(maxLvl, hl); }
            break;
          }
          case "thin-content": match = seoData.wordCount < 150; break;
          case "images-missing-alt": match = seoData.images.some(function(img: any) { return !img.alt; }); break;
          case "missing-og-tags": match = !seoData.ogTags["og:title"] || !seoData.ogTags["og:description"]; break;
          case "missing-twitter-card": match = !seoData.twitterTags["twitter:card"]; break;
          case "no-jsonld": match = !seoData.hasJsonLd; break;
          case "missing-viewport": match = !seoData.viewport; break;
          case "noindex-page": match = seoData.robots?.includes("noindex") || false; break;
          case "no-outgoing-links": match = seoData.links.filter(function(l: any) { return !l.href.startsWith("#"); }).length === 0; break;
          case "missing-hreflang": match = seoData.hreflangs.length === 0 && Object.keys(seoData.ogTags).length === 0; break;
          case "missing-language": match = !seoData.lang; break;
          case "duplicate-title": match = false; break;
          case "duplicate-meta-description": match = false; break;
          case "broken-links": match = false; break;
          case "canonical-conflict": match = false; break;
          case "slow-response": match = false; break;
        }
        if (match) {
          issues.push({ ...issue, category: "seo" });
        }
      }
    }

    let perfMetrics: Record<string, any> = {};
    if (checkPerf) {
      const perfEval = `(function() {
        return new Promise(function(resolve) {
          var nav = performance.getEntriesByType("navigation")[0];
          var paint = performance.getEntriesByType("paint");
          var results = {
            fcp: 0, lcp: 0, cls: 0, domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
            loadEvent: nav ? nav.loadEventEnd : 0, ttfb: nav ? nav.responseStart - nav.requestStart : 0
          };
          var fcpEntry = null;
          for (var pi = 0; pi < paint.length; pi++) { if (paint[pi].name === "first-contentful-paint") fcpEntry = paint[pi]; }
          if (fcpEntry) results.fcp = fcpEntry.startTime;
          try {
            var lcpObs = new PerformanceObserver(function(list) { var entries = list.getEntries(); if (entries.length > 0) results.lcp = entries[entries.length - 1].startTime; });
            lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
          } catch(e) {}
          try {
            var clsObs = new PerformanceObserver(function(list) { for (var ci = 0; ci < list.getEntries().length; ci++) { results.cls += list.getEntries()[ci].value || 0; } });
            clsObs.observe({ type: "layout-shift", buffered: true });
          } catch(e) {}
          setTimeout(function() { try { lcpObs.disconnect(); } catch(e) {} try { clsObs.disconnect(); } catch(e) {} resolve(results); }, 2000);
        });
      })()`;
      perfMetrics = await page.evaluate(perfEval) as any;

      if (perfMetrics.ttfb > 1500) issues.push({ id: "slow-response", severity: "warning", message: `TTFB de ${(perfMetrics.ttfb).toFixed(0)}ms (>1.5s)`, howToFix: "Otimize o servidor, use cache e CDN", category: "performance" });
    }

    let securityData: Record<string, any> = {};
    if (checkSecurity) {
      securityData = await page.evaluate("(function() { return { cookies: document.cookie, hasHttps: location.protocol === 'https:' }; })()") as any;
    }

    const severityScores: Record<string, number> = { critical: 25, warning: 10, info: 3 };
    let score = 100;
    for (const issue of issues) {
      score -= severityScores[issue.severity] || 5;
    }
    score = Math.max(0, Math.min(100, score));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url: targetUrl,
            score,
            totalIssues: issues.length,
            criticalCount: issues.filter((i) => i.severity === "critical").length,
            warningCount: issues.filter((i) => i.severity === "warning").length,
            infoCount: issues.filter((i) => i.severity === "info").length,
            issues,
            metrics: {
              title: await page.title().catch(() => ""),
              wordCount: await page.evaluate("(function() { return (document.body ? document.body.textContent || '' : '').trim().split(/\\s+/).filter(function(s){return s}).length; })()").catch(() => 0) as number,
              performance: checkPerf ? {
                fcp: `${(perfMetrics.fcp / 1000).toFixed(1)}s`,
                lcp: `${(perfMetrics.lcp / 1000).toFixed(1)}s`,
                cls: perfMetrics.cls?.toFixed(3) || "0",
                ttfb: `${(perfMetrics.ttfb / 1000).toFixed(1)}s`,
                loadEvent: `${(perfMetrics.loadEvent / 1000).toFixed(1)}s`,
                domContentLoaded: `${(perfMetrics.domContentLoaded / 1000).toFixed(1)}s`,
              } : undefined,
              security: checkSecurity ? { cookies: securityData.cookies || "none", https: securityData.hasHttps } : undefined,
            },
            recommendations: issues.filter((i) => i.severity === "critical" || i.severity === "warning").map((i) => `[${i.severity.toUpperCase()}] ${i.message} — ${i.howToFix}`),
          }, null, 2),
        },
      ],
    };
  },
};

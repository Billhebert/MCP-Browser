import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getContext } from "../browser.js";
import { isSafeUrl } from "../corporate/ssrf.js";
import { broadcast } from "../http/wsHandler.js";
import { analyzeSeoTool } from "./analyzeSeo.js";
import { checkA11yTool } from "./checkA11y.js";
import { checkSecurityTool } from "./checkSecurity.js";
import { checkContrastTool } from "./checkContrast.js";
import { checkImagesTool } from "./checkImages.js";
import { checkCacheTool } from "./checkCache.js";
import { checkTypographyTool } from "./checkTypography.js";
import { checkThirdPartiesTool } from "./checkThirdParties.js";
import { checkSslTool } from "./checkSsl.js";
import { checkCookiesConsentTool } from "./checkCookiesConsent.js";
import { checkPrivacyFormsTool } from "./checkPrivacyForms.js";
import { lighthouseAuditTool } from "./lighthouseAudit.js";
import { perfBudgetTool } from "./perfBudget.js";
import { networkWaterfallTool } from "./networkWaterfall.js";
import { checkReadabilityTool } from "./checkReadability.js";
import { checkSpellingTool } from "./checkSpelling.js";
import { checkBrokenAnchorsTool } from "./checkBrokenAnchors.js";
import { validateJsonLdTool } from "./validateJsonLd.js";
import { checkAccessibilityTreeTool } from "./checkAccessibilityTree.js";

interface ToolEntry {
  name: string;
  tool: ToolDefinition;
  defaultArgs?: Record<string, unknown>;
  weight: number;
}

interface PageToolResult {
  tool: string;
  category: string;
  status: string;
  score: number | null;
  issues: any[];
  duration: number;
  error?: string;
  raw?: any;
}

interface PageAuditResult {
  url: string;
  title: string;
  status: string;
  loadTimeMs: number;
  toolResults: PageToolResult[];
  error?: string;
}

interface CrossPagePattern {
  type: string;
  category: string;
  severity: string;
  message: string;
  affectedPages: string[];
  affectedCount: number;
  totalPages: number;
  percentage: number;
  value?: number;
  threshold?: number;
  pass?: boolean;
}

interface CategorySummary {
  averageScore: number;
  minScore: number;
  maxScore: number;
  passCount: number;
  failCount: number;
  toolsUsed: string[];
}

const CATEGORIES: Record<string, { tools: ToolEntry[] }> = {
  seo: {
    tools: [
      { name: "analyze_seo", tool: analyzeSeoTool, weight: 30 },
      { name: "validate_json_ld", tool: validateJsonLdTool, weight: 15 },
      { name: "check_broken_anchors", tool: checkBrokenAnchorsTool, weight: 10 },
      { name: "check_spelling", tool: checkSpellingTool, weight: 10 },
    ],
  },
  a11y: {
    tools: [
      { name: "check_a11y", tool: checkA11yTool, weight: 35, defaultArgs: { wcagLevel: "aa" } },
      { name: "check_contrast", tool: checkContrastTool, weight: 25 },
      { name: "check_accessibility_tree", tool: checkAccessibilityTreeTool, weight: 20 },
      { name: "check_images", tool: checkImagesTool, weight: 20 },
    ],
  },
  performance: {
    tools: [
      { name: "lighthouse_audit", tool: lighthouseAuditTool, weight: 40 },
      { name: "perf_budget", tool: perfBudgetTool, weight: 25 },
      { name: "check_cache", tool: checkCacheTool, weight: 20 },
      { name: "network_waterfall", tool: networkWaterfallTool, weight: 15 },
    ],
  },
  security: {
    tools: [
      { name: "check_security", tool: checkSecurityTool, weight: 40 },
      { name: "check_ssl", tool: checkSslTool, weight: 30 },
      { name: "check_third_parties", tool: checkThirdPartiesTool, weight: 30 },
    ],
  },
  privacy: {
    tools: [
      { name: "check_privacy_forms", tool: checkPrivacyFormsTool, weight: 40 },
      { name: "check_cookies_consent", tool: checkCookiesConsentTool, weight: 30 },
      { name: "check_third_parties", tool: checkThirdPartiesTool, weight: 30 },
    ],
  },
  content: {
    tools: [
      { name: "check_readability", tool: checkReadabilityTool, weight: 40 },
      { name: "check_spelling", tool: checkSpellingTool, weight: 30 },
      { name: "check_typography", tool: checkTypographyTool, weight: 30 },
    ],
  },
};

const CATEGORY_ORDER = ["seo", "a11y", "performance", "security", "privacy", "content"];

function flattenTools(categories?: string[]): ToolEntry[] {
  const names = categories && categories.length > 0 ? new Set(categories) : new Set(CATEGORY_ORDER);
  const all: ToolEntry[] = [];
  for (const [cat, config] of Object.entries(CATEGORIES)) {
    if (names.has(cat)) {
      all.push(...config.tools);
    }
  }
  // Deduplicate by name
  const seen = new Set<string>();
  return all.filter((t) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}

function findCategory(toolName: string): string {
  for (const [cat, config] of Object.entries(CATEGORIES)) {
    if (config.tools.some((t) => t.name === toolName)) return cat;
  }
  return "other";
}

function extractScore(text: string): number | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.score === "number") return parsed.score;
    if (parsed.scores) {
      const vals = Object.values(parsed.scores).filter((v): v is number => typeof v === "number");
      if (vals.length > 0) return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  } catch {}
  return null;
}

function extractIssues(text: string): any[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.issues)) return parsed.issues;
    if (Array.isArray(parsed.results)) return parsed.results;
  } catch {}
  return [];
}

function isSameDomain(url: string, base: string): boolean {
  try { return new URL(url).hostname === new URL(base).hostname; } catch { return false; }
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.pathname = u.pathname.replace(/\/index\.html$|\/index\.htm$|\/default\.aspx$/i, "/").replace(/\/+$/, "") || "/";
    return u.href;
  } catch { return raw; }
}

function matchesExclude(url: string, patterns: string[]): boolean {
  return patterns.some((p) => url.includes(p));
}

function matchesInclude(url: string, patterns: string[]): boolean {
  if (!patterns.length) return true;
  return patterns.some((p) => url.includes(p));
}

async function fetchSitemapUrls(url: string, signal?: AbortSignal): Promise<string[]> {
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
  } catch { return []; }
}

async function discoverUrls(
  startUrl: string,
  maxPages: number,
  maxDepth: number,
  exclude: string[],
  include: string[],
  useSitemap: boolean,
): Promise<string[]> {
  const discovered = new Set<string>();

  if (useSitemap) {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    try {
      const sitemapUrl = new URL("/sitemap.xml", startUrl).href;
      const sitemapCheck = isSafeUrl(sitemapUrl);
      if (!sitemapCheck.safe) {
        console.error(`⚠️ Sitemap URL bloqueada: ${sitemapCheck.reason}`);
      }
      const urls = await fetchSitemapUrls(sitemapUrl, ac.signal);
      for (const u of urls) {
        const n = normalizeUrl(u);
        if (isSameDomain(n, startUrl) && matchesInclude(n, include) && !matchesExclude(n, exclude)) {
          discovered.add(n);
        }
      }
    } finally { clearTimeout(timeout); }
  }

  if (discovered.size < maxPages) {
    const ctx = await getContext();
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: normalizeUrl(startUrl), depth: 0 }];

    while (queue.length > 0 && visited.size < maxPages) {
      const item = queue.shift()!;
      if (visited.has(item.url) || matchesExclude(item.url, exclude)) continue;
      if (!matchesInclude(item.url, include)) continue;

      try {
        const p = await ctx.newPage();
        await p.goto(item.url, { waitUntil: "domcontentloaded", timeout: 15000 });
        visited.add(item.url);
        discovered.add(item.url);

        if (item.depth < maxDepth) {
          const links: string[] = await p.evaluate(() =>
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
        await p.close();
      } catch {
        visited.add(item.url);
      }
    }
  }

  return Array.from(discovered);
}

async function auditSinglePage(
  ctx: any,
  url: string,
  tools: ToolEntry[],
): Promise<PageAuditResult> {
  const page = await ctx.newPage();
  const startTime = Date.now();
  const toolResults: PageToolResult[] = [];
  let pageTitle = "";
  let navError: string | undefined;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    pageTitle = await page.title().catch(() => "");
    await page.waitForTimeout(1500);

    for (const entry of tools) {
      const t0 = Date.now();
      try {
        const res = await entry.tool.execute(entry.defaultArgs || {});
        const text = res.content?.[0]?.text || "{}";
        const parsed = JSON.parse(text);
        const score = extractScore(text);
        const issues = extractIssues(text);
        toolResults.push({
          tool: entry.name,
          category: findCategory(entry.name),
          status: "pass",
          score,
          issues,
          duration: Date.now() - t0,
          raw: parsed,
        });
      } catch (err) {
        toolResults.push({
          tool: entry.name,
          category: findCategory(entry.name),
          status: "error",
          score: null,
          issues: [],
          duration: Date.now() - t0,
          error: (err as Error).message,
        });
      }
    }
  } catch (err) {
    navError = (err as Error).message;
  } finally {
    await page.close().catch(() => {});
  }

  return {
    url,
    title: pageTitle,
    status: navError ? "error" : "success",
    loadTimeMs: Date.now() - startTime,
    toolResults,
    error: navError,
  };
}

function analyzeCrossPagePatterns(pageResults: PageAuditResult[]): CrossPagePattern[] {
  const patterns: CrossPagePattern[] = [];

  // Group issues by type+message across pages
  const issueMap = new Map<string, { message: string; severity: string; category: string; pages: string[] }>();
  for (const page of pageResults) {
    for (const tool of page.toolResults) {
      const issues = tool.issues || [];
      for (const issue of issues) {
        const key = `${issue.type || "unknown"}:${issue.message || "unknown"}`;
        if (!issueMap.has(key)) {
          issueMap.set(key, { message: issue.message || "", severity: issue.severity || "low", category: tool.category, pages: [] });
        }
        issueMap.get(key)!.pages.push(page.url);
      }
    }
  }

  for (const [, data] of issueMap) {
    if (data.pages.length >= 2) {
      patterns.push({
        type: "cross-page",
        category: data.category,
        severity: data.severity,
        message: data.message,
        affectedPages: data.pages,
        affectedCount: data.pages.length,
        totalPages: pageResults.length,
        percentage: Math.round((data.pages.length / pageResults.length) * 100),
      });
    }
  }

  // Analyze meta descriptions across pages
  const pagesWithoutMetaDesc: string[] = [];
  const pagesWithoutTitle: string[] = [];
  const pagesMultipleH1: string[] = [];
  const pagesWithoutH1: string[] = [];

  for (const page of pageResults) {
    for (const tool of page.toolResults) {
      if (tool.tool === "analyze_seo" && tool.raw) {
        const raw = tool.raw;
        if (raw.missingMetaDescription) pagesWithoutMetaDesc.push(page.url);
        if (!raw.title || raw.title === "") pagesWithoutTitle.push(page.url);
        if (raw.h1Count === 0) pagesWithoutH1.push(page.url);
        if (raw.h1Count && raw.h1Count > 1) pagesMultipleH1.push(page.url);
      }
    }
  }

  const addPattern = (pages: string[], msg: string, sev: string, cat: string) => {
    if (pages.length >= 2) {
      patterns.push({
        type: "summary",
        category: cat,
        severity: sev,
        message: msg,
        affectedPages: pages,
        affectedCount: pages.length,
        totalPages: pageResults.length,
        percentage: Math.round((pages.length / pageResults.length) * 100),
      });
    }
  };

  addPattern(pagesWithoutMetaDesc, "Páginas sem meta description", "high", "seo");
  addPattern(pagesWithoutTitle, "Páginas sem tag <title>", "high", "seo");
  addPattern(pagesWithoutH1, "Páginas sem tag <h1>", "medium", "seo");
  addPattern(pagesMultipleH1, "Páginas com múltiplos <h1>", "medium", "seo");

  // Performance summary
  const lcpValues: number[] = [];
  const clsValues: number[] = [];
  for (const page of pageResults) {
    for (const tool of page.toolResults) {
      if (tool.tool === "lighthouse_audit" && tool.raw?.metrics) {
        const m = tool.raw.metrics;
        const lcp = parseFloat(m.lcp);
        const cls = parseFloat(m.cls);
        if (!isNaN(lcp)) lcpValues.push(lcp);
        if (!isNaN(cls)) clsValues.push(cls);
      }
    }
  }

  if (lcpValues.length > 0) {
    const avgLcp = lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length;
    patterns.push({
      type: "summary",
      category: "performance",
      severity: avgLcp > 2.5 ? "high" : "info",
      message: `LCP médio do site: ${avgLcp.toFixed(1)}s`,
      affectedPages: [],
      affectedCount: lcpValues.length,
      totalPages: pageResults.length,
      percentage: 100,
      value: avgLcp,
      threshold: 2.5,
      pass: avgLcp <= 2.5,
    });
  }

  if (clsValues.length > 0) {
    const avgCls = clsValues.reduce((a, b) => a + b, 0) / clsValues.length;
    patterns.push({
      type: "summary",
      category: "performance",
      severity: avgCls > 0.1 ? "medium" : "info",
      message: `CLS médio do site: ${avgCls.toFixed(3)}`,
      affectedPages: [],
      affectedCount: clsValues.length,
      totalPages: pageResults.length,
      percentage: 100,
      value: avgCls,
      threshold: 0.1,
      pass: avgCls <= 0.1,
    });
  }

  return patterns;
}

function computeDashboard(
  pageResults: PageAuditResult[],
  patterns: CrossPagePattern[],
  thresholds: Record<string, number>,
  startUrl: string,
) {
  const totalPages = pageResults.length;
  const successfulPages = pageResults.filter((p) => p.status === "success");
  const failedPages = pageResults.filter((p) => p.status === "error");

  const perPage: any[] = [];
  let totalIssuesFound = 0;

  for (const page of pageResults) {
    const categoryScores: Record<string, number> = {};
    for (const cat of CATEGORY_ORDER) {
      const scores = page.toolResults
        .filter((t) => t.category === cat && t.score !== null)
        .map((t) => t.score as number);
      if (scores.length > 0) {
        categoryScores[cat] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    }

    const catScores = Object.values(categoryScores).filter((s) => s !== undefined) as number[];
    const overallScore = catScores.length > 0
      ? Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length)
      : 0;

    const toolResults = page.toolResults.map((t) => ({
      tool: t.tool,
      category: t.category,
      status: t.status,
      score: t.score,
      issueCount: t.issues?.length || 0,
      duration: t.duration,
      error: t.error,
    }));

    const pageIssues = page.toolResults.reduce((sum, t) => sum + (t.issues?.length || 0), 0);
    totalIssuesFound += pageIssues;

    perPage.push({
      url: page.url,
      title: page.title,
      status: page.status,
      loadTimeMs: page.loadTimeMs,
      overallScore,
      categoryScores,
      totalIssues: pageIssues,
      toolResults,
      error: page.error,
    });
  }

  const categories: Record<string, CategorySummary> = {};
  for (const cat of CATEGORY_ORDER) {
    const scores = perPage
      .map((p) => p.categoryScores[cat])
      .filter((s) => s !== undefined) as number[];
    if (scores.length > 0) {
      const threshold = thresholds[cat] || 70;
      categories[cat] = {
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        passCount: scores.filter((s) => s >= threshold).length,
        failCount: scores.filter((s) => s < threshold).length,
        toolsUsed: CATEGORIES[cat].tools.map((t) => t.name),
      };
    }
  }

  const allScores = perPage.map((p) => p.overallScore).filter((s) => s !== undefined) as number[];
  const overallSiteScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // Worst pages
  const sorted = [...perPage].filter((p) => p.status === "success").sort((a, b) => a.overallScore - b.overallScore);
  const worstPages = sorted.slice(0, 5).map((p) => ({
    url: p.url,
    score: p.overallScore,
    worstCategory: Object.entries(p.categoryScores).sort(([, a], [, b]) => (a as number) - (b as number))?.[0]?.[0] || "",
  }));

  // Generate recommendations from patterns
  const recommendations: string[] = [];
  for (const p of patterns) {
    if (p.affectedCount >= 2 && p.severity !== "info") {
      recommendations.push(`${p.severity === "high" ? "🔴" : "🟡"} ${p.message} (${p.affectedCount}/${p.totalPages} pages, ${p.percentage}%)`);
    }
  }

  return {
    site: {
      url: startUrl,
      totalPages,
      successfulPages: successfulPages.length,
      failedPages: failedPages.length,
      totalIssuesFound,
      overallScore: overallSiteScore,
    },
    categories,
    patterns,
    perPage,
    worstPages,
    recommendations: recommendations.slice(0, 20),
  };
}

export const fullSiteAuditTool: ToolDefinition = {
  name: "full_site_audit",
  description: "Unlighthouse-style full site audit: crawl all pages, run all tools, consolidate dashboard.",
  args: {
    url: z.string().max(5000).optional().describe("URL inicial para witheçar (default: URL current do browser)"),
    maxPages: z.number().optional().describe("Máximo de pages para auditar (default: 10)"),
    maxDepth: z.number().optional().describe("depth máxima de crawl (default: 2)"),
    exclude: z.string().max(100).optional().describe("Padrões de URL para exclude (separated por vírgula)"),
    include: z.string().max(100).optional().describe("Padrões de URL para include (separated por vírgula)"),
    categories: z.string().max(50000).optional().describe("Categorias para auditar: 'seo,a11y,performance,security,privacy,content' ou 'all' (padrão: 'all')"),
    concurrency: z.number().optional().describe("Número de pages auditadas em paralelo (default: 3)"),
    thresholds: z.string().max(50000).optional().describe("JSON com thresholds de score por categoria. ex: {\"seo\":70,\"a11y\":80}"),
    noSitemap: z.boolean().optional().describe("If true, pula sitemap.xml (default: false)"),
  },
  async execute(args: {
    url?: string;
    maxPages?: number;
    maxDepth?: number;
    exclude?: string;
    include?: string;
    categories?: string;
    concurrency?: number;
    thresholds?: string;
    noSitemap?: boolean;
  }) {
    const ctx = await getContext();
    const startUrl = args.url || ctx.pages()[0]?.url();
    if (!startUrl) {
      return {
        content: [{ type: "text", text: "Navegue para uma página primeiro ou forneça uma URL." }],
        isError: true,
      };
    }

    const maxPages = args.maxPages || 10;
    const maxDepth = args.maxDepth || 2;
    const exclude = args.exclude ? args.exclude.split(",").map((s) => s.trim()) : [];
    const include = args.include ? args.include.split(",").map((s) => s.trim()) : [];
    const concurrency = args.concurrency || 3;
    const thresholds: Record<string, number> = args.thresholds ? JSON.parse(args.thresholds) : {};
    const useSitemap = !args.noSitemap;

    const catFilter = args.categories && args.categories !== "all"
      ? args.categories.split(",").map((s) => s.trim())
      : undefined;

    const selectedTools = flattenTools(catFilter);

    console.error(`🔍 Full Site Audit: ${startUrl}`);
    console.error(`  Max pages: ${maxPages}, depth: ${maxDepth}, concurrency: ${concurrency}`);
    console.error(`  Tools: ${selectedTools.length} (categories: ${catFilter?.join(", ") || "all"})`);

    // Phase 1: Discover URLs
    console.error(`  Descobrindo URLs...`);
    broadcast("audit:status", { phase: "discovering", message: "Descobrindo URLs via sitemap + crawl" });
    const urls = await discoverUrls(startUrl, maxPages, maxDepth, exclude, include, useSitemap);
    if (urls.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Nenhuma URL encontrada para auditar." }, null, 2) }],
        isError: true,
      };
    }
    console.error(`  ✅ ${urls.length} URLs descobertas`);
    broadcast("audit:discovered", { urls, count: urls.length });

    // Phase 2: Audit each page with concurrency
    const overallStart = Date.now();
    const pageResults: PageAuditResult[] = [];
    let completedCount = 0;

    broadcast("audit:status", { phase: "scanning", message: `Auditando ${urls.length} pages` });

    // Use chunks for concurrency control
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (url) => {
          broadcast("audit:page-start", { url, index: completedCount, total: urls.length });
          const result = await auditSinglePage(ctx, url, selectedTools);
          const sc = result.toolResults.find((t) => t.score !== null)?.score ?? null;
          completedCount++;
          broadcast("audit:page-complete", {
            url,
            title: result.title,
            status: result.status,
            score: sc,
            toolCount: result.toolResults.length,
            issueCount: result.toolResults.reduce((s, t) => s + (t.issues?.length || 0), 0),
            loadTimeMs: result.loadTimeMs,
          });
          broadcast("audit:progress", { completed: completedCount, total: urls.length, elapsed: Date.now() - overallStart });
          return result;
        }),
      );
      pageResults.push(...chunkResults);
      for (const r of chunkResults) {
        const s = r.status === "success" ? "✅" : "❌";
        const sc = r.toolResults.find((t) => t.score !== null)?.score ?? "-";
        console.error(`  ${s} ${r.url} — score ${sc}, ${r.toolResults.length} tools`);
      }
    }

    const scanDurationMs = Date.now() - overallStart;

    // Phase 3: Cross-page pattern analysis
    broadcast("audit:status", { phase: "analyzing", message: "Analisando padrões cross-page" });
    const patterns = analyzeCrossPagePatterns(pageResults);

    // Phase 4: Compute dashboard
    const dashboard = computeDashboard(pageResults, patterns, thresholds, startUrl);
    (dashboard.site as any).scanDurationMs = scanDurationMs;
    (dashboard.site as any).crawlSource = useSitemap ? "sitemap+live" : "live";

    console.error(`✅ Full Site Audit concluído: ${urls.length} pages em ${(scanDurationMs / 1000).toFixed(1)}s`);
    console.error(`  Score geral: ${dashboard.site.overallScore}`);
    console.error(`  Issues: ${dashboard.site.totalIssuesFound}`);
    console.error(`  Padrões cross-page: ${patterns.length}`);

    broadcast("audit:complete", { dashboard });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(dashboard, null, 2),
      }],
    };
  },
};

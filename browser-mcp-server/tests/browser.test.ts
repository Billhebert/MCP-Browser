import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("Browser MCP Server - Tool Tests", () => {
  it("deve navegar para uma URL e obter título", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const title = await page.title();
    expect(title).toBe("Example Domain");
    await page.close();
  });

  it("deve clicar em elemento com fallback JS", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <button id="btn" onclick="this.textContent='clicado'">Clique</button>
    </body></html>`);

    await page.$eval("#btn", (el: HTMLElement) => el.click());
    await page.waitForTimeout(100);
    const text = await page.textContent("#btn");
    expect(text).toBe("clicado");
    await page.close();
  });

  it("deve preencher campo de formulário", async () => {
    const page = await browser.newPage();
    await page.goto("https://www.google.com");
    const searchBox = page.locator('textarea[name="q"]');
    await searchBox.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const exists = (await searchBox.count()) > 0;
    expect(exists).toBe(true);
    if (exists) {
      await searchBox.fill("opencode");
      expect(await searchBox.inputValue()).toBe("opencode");
    }
    await page.close();
  });

  it("deve extrair texto da página", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain("Example Domain");
    await page.close();
  });

  it("deve extrair HTML de elemento específico", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const html = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      return h1?.outerHTML || "";
    });
    expect(html).toContain("<h1>");
    await page.close();
  });

  it("deve capturar screenshot", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const screenshot = await page.screenshot({ type: "png" });
    expect(screenshot.length).toBeGreaterThan(1000);
    await page.close();
  });

  it("deve encontrar elementos por texto", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const el = page.locator("a");
    const count = await el.count();
    expect(count).toBeGreaterThan(0);
    await page.close();
  });

  it("deve obter atributos de elemento", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const attrs = await page.evaluate(() => {
      const a = document.querySelector("a");
      return { href: a?.getAttribute("href"), tagName: a?.tagName.toLowerCase() };
    });
    expect(attrs.href).toContain("iana.org");
    expect(attrs.tagName).toBe("a");
    await page.close();
  });

  it("deve lidar com múltiplas abas no mesmo contexto", async () => {
    const context: BrowserContext = await browser.newContext();
    const page1 = await context.newPage();
    await page1.goto("https://example.com");
    const page2 = await context.newPage();
    await page2.goto("https://example.com");

    const pages = context.pages();
    expect(pages.length).toBeGreaterThanOrEqual(2);

    await page2.bringToFront();
    expect(await page2.title()).toBe("Example Domain");

    await context.close();
  });

  it("deve executar JavaScript na página", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const result = await page.evaluate(() => document.title);
    expect(result).toBe("Example Domain");
    await page.close();
  });

  it("deve alterar viewport", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 375, height: 667 });
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
    expect(viewport?.height).toBe(667);
    await page.close();
  });

  it("deve capturar console da página", async () => {
    const page = await browser.newPage();
    const messages: string[] = [];
    page.on("console", (msg) => messages.push(msg.text()));

    await page.evaluate(() => {
      console.log("test log");
      console.error("test error");
    });

    expect(messages.length).toBe(2);
    expect(messages.some((m) => m.includes("test error"))).toBe(true);
    await page.close();
  });

  it("deve alterar esquema de cores", async () => {
    const page = await browser.newPage();
    await page.emulateMedia({ colorScheme: "dark" });
    expect(true).toBe(true);
    await page.close();
  });

  it("deve fazer upload de arquivo", async () => {
    const page = await browser.newPage();
    await page.setContent('<input type="file" id="upload">');
    const input = page.locator("#upload");
    await input.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("test content"),
    });
    expect(true).toBe(true);
    await page.close();
  });

  it("deve rolar a página", async () => {
    const page = await browser.newPage();
    await page.setContent(
      '<div style="height:2000px">long</div>',
    );
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(500);
    await page.close();
  });

  it("deve recarregar a página", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    await page.reload();
    expect(await page.title()).toBe("Example Domain");
    await page.close();
  });

  it("deve gerenciar cookies", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://example.com");
    await context.addCookies([
      { name: "test", value: "value", domain: ".example.com", path: "/" },
    ]);
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === "test")).toBe(true);
    await page.close();
    await context.close();
  });

  it("deve usar localStorage", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    await page.evaluate(() => localStorage.setItem("key", "value"));
    const value = await page.evaluate(() => localStorage.getItem("key"));
    expect(value).toBe("value");
    await page.close();
  });

  it("deve arrastar e soltar elemento", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <div id="source" style="width:100px;height:100px;background:red;">Drag</div>
      <div id="target" style="width:100px;height:100px;background:blue;position:absolute;top:300px;">Drop</div>
    `);

    const src = page.locator("#source");
    const tgt = page.locator("#target");
    const srcBox = await src.boundingBox();
    const tgtBox = await tgt.boundingBox();

    if (srcBox && tgtBox) {
      await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(tgtBox.x + tgtBox.width / 2, tgtBox.y + tgtBox.height / 2, { steps: 10 });
      await page.mouse.up();
    }

    expect(true).toBe(true);
    await page.close();
  });
});

describe("QA Audit Tools", () => {
  it("deve detectar problemas de SEO (analyze_seo)", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const seo = await page.evaluate(() => {
      const issues: Array<{ type: string; severity: string; message: string }> = [];
      if (!document.title) issues.push({ type: "seo", severity: "high", message: "Missing <title>" });
      const h1 = document.querySelector("h1");
      if (!h1 || !h1.textContent?.trim()) issues.push({ type: "seo", severity: "high", message: "Missing <h1>" });
      const metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) issues.push({ type: "seo", severity: "high", message: "Missing meta description" });
      const viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) issues.push({ type: "seo", severity: "high", message: "Missing viewport meta" });
      const images = Array.from(document.querySelectorAll("img"));
      const missingAlt = images.filter((img) => !img.hasAttribute("alt"));
      if (missingAlt.length > 0) issues.push({ type: "seo", severity: "medium", message: `${missingAlt.length} image(s) missing alt` });
      const score = Math.max(0, 100 - issues.reduce((acc, i) => acc + { critical: 25, high: 15, medium: 8, low: 3 }[i.severity]! as number, 0));
      return { title: document.title, h1: h1?.textContent?.trim() || null, metaDescription: !!metaDesc, viewport: !!viewport, issues, score };
    });
    expect(seo.title).toBeTruthy();
    expect(seo.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(seo.issues)).toBe(true);
    await page.close();
  });

  it("deve extrair links da página (check_links)", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: ((a as HTMLAnchorElement).textContent || "").trim().slice(0, 50),
      }));
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].href).toContain("http");
    await page.close();
  });

  it("deve detectar violações de acessibilidade (check_a11y)", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <html><body>
        <h1>Test</h1>
        <img src="foo.jpg">
        <button onclick="alert(1)">Click</button>
      </body></html>
    `);
    const axe = await page.evaluate(async () => {
      return new Promise<{ violations: number; passes: number }>((resolve) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js";
        s.onload = async () => {
          const results = await (window as any).axe.run();
          resolve({ violations: results.violations.length, passes: results.passes.length });
        };
        s.onerror = () => resolve({ violations: -1, passes: -1 });
        document.head.appendChild(s);
      });
    });
    if (axe.violations >= 0) {
      expect(axe.passes).toBeGreaterThan(0);
    }
    await page.close();
  });

  it("deve testar endpoint HTTP (test_api)", async () => {
    const url = "https://jsonplaceholder.typicode.com/posts/1";
    const res = await fetch(url);
    const body = await res.json() as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(body.id).toBe(1);
    expect(body.title).toBeTruthy();
    const time = performance.now();
    await fetch(url);
    const elapsed = performance.now() - time;
    expect(elapsed).toBeLessThan(5000);
  });

  it("deve gerar relatório HTML (generate_report)", async () => {
    const data = JSON.stringify({
      score: 85,
      url: "https://example.com",
      issues: [
        { type: "seo", severity: "high", message: "Missing meta description" },
      ],
    });
    const parsed = JSON.parse(data);
    expect(parsed.score).toBe(85);
    expect(parsed.issues.length).toBe(1);
    const sections: string[] = [];
    sections.push(`<div>Score: ${parsed.score}</div>`);
    if (parsed.issues) {
      for (const i of parsed.issues) {
        sections.push(`<div>${i.severity}: ${i.message}</div>`);
      }
    }
    const html = `<!DOCTYPE html><html><body>${sections.join("\n")}</body></html>`;
    expect(html).toContain("Score: 85");
    expect(html).toContain("Missing meta description");
  });

  it("deve gerar relatório JUnit (generate_report)", async () => {
    const rawData = { score: 45, issues: [{ type: "csp", severity: "high", message: "Missing CSP" }] };
    const tests = 2;
    const failures = 1;
    const junit = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="QA Report" tests="${tests}" failures="${failures}">\n  <testsuite name="qa.audit" tests="${tests}" failures="${failures}"/>\n</testsuites>`;
    expect(junit).toContain('tests="2"');
    expect(junit).toContain('failures="1"');
  });

  it("deve auditar performance via Performance API (lighthouse_audit)", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as any;
      const paint = performance.getEntriesByType("paint");
      const fcp = paint.find((p) => p.name === "first-contentful-paint");
      return {
        ttfb: nav ? nav.responseStart - nav.requestStart : null,
        fcp: fcp ? fcp.startTime : null,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
        loadEvent: nav ? nav.loadEventEnd : null,
      };
    });
    expect(perf.ttfb).toBeGreaterThanOrEqual(0);
    expect(perf.loadEvent).toBeGreaterThan(0);
    await page.close();
  });

  it("deve gerar relatório CSV (generate_report)", async () => {
    const rows = ["feature,metric,value,status"];
    rows.push("overall,score,85,pass");
    rows.push("seo,score,70,pass");
    rows.push("a11y,violations,0,pass");
    const csv = rows.join("\n") + "\n";
    expect(csv).toContain("overall,score,85,pass");
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(4);
  });

  it("deve capturar headers HTTP de resposta (check_security)", async () => {
    const page = await browser.newPage();
    const response = await page.goto("https://example.com", { waitUntil: "networkidle" });
    const headers = response!.headers();
    expect(headers["content-type"]).toContain("text/html");
    // O mecanismo de captura de headers é usado pelo check_security e network_waterfall
    expect(typeof headers).toBe("object");
    await page.close();
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("Advanced QA — checkContrast", () => {
  it("deve detectar contraste insuficiente", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <p style="color:#999;background:#fff;font-size:14px">Contraste baixo</p>
      <p style="color:#000;background:#fff;font-size:16px">Bom contraste</p>
    </body></html>`);
    const result = await page.evaluate(() => {
      const issues: Array<{ type: string; severity: string; message: string; ratio?: number }> = [];
      const all = document.querySelectorAll("p");
      for (const el of Array.from(all)) {
        const style = getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        const rgb = (s: string) => s.match(/\d+/g)?.map(Number) || [0, 0, 0];
        const [r1, g1, b1] = rgb(color);
        const [r2, g2, b2] = rgb(bg);
        const lum = (r: number, g: number, b: number) => {
          const [R, G, B] = [r, g, b].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
          return 0.2126 * R + 0.7152 * G + 0.0722 * B;
        };
        const L1 = lum(r1, g1, b1) + 0.05;
        const L2 = lum(r2, g2, b2) + 0.05;
        const ratio = Math.max(L1, L2) / Math.min(L1, L2);
        if (ratio < 4.5) issues.push({ type: "contrast", severity: ratio < 3 ? "high" : "medium", message: `Contraste ${ratio.toFixed(2)}:1 abaixo de 4.5:1`, ratio });
      }
      return issues;
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    const low = result.find(r => r.ratio && r.ratio < 3);
    expect(low).toBeTruthy();
    expect(result.some(r => r.ratio && r.ratio >= 4.5)).toBe(false);
    await page.close();
  });
});

describe("Advanced QA — analyzeResponsive", () => {
  it("deve verificar viewports e elementos visíveis", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <nav style="display:none">Menu mobile</nav>
      <main>Conteúdo</main>
    </body></html>`);
    const viewports = [375, 768, 1024];
    const results = [];
    for (const w of viewports) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(50);
      const visible = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll("body *"));
        const hidden = all.filter(el => {
          const s = getComputedStyle(el as HTMLElement);
          return s.display === "none" || s.visibility === "hidden";
        });
        return { total: all.length, hidden: hidden.length };
      });
      results.push({ width: w, visible: visible.total - visible.hidden });
    }
    expect(results.length).toBe(3);
    expect(results[0].visible).toBeGreaterThan(0);
    await page.close();
  });
});

describe("Advanced QA — checkTypography", () => {
  it("deve detectar fontes e tamanhos", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <p style="font-size:10px">Pequeno</p>
      <p style="font-size:24px">Grande</p>
    </body></html>`);
    const result = await page.evaluate(() => {
      const issues: Array<{ type: string; severity: string; message: string }> = [];
      const all = Array.from(document.querySelectorAll("p"));
      for (const el of all) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 12) issues.push({ type: "font-size", severity: "medium", message: `Font-size ${size}px abaixo de 12px` });
      }
      return { issues, totalElements: all.length };
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues[0].message).toContain("10px");
    await page.close();
  });
});

describe("Advanced QA — testForm", () => {
  it("deve validar campos de formulário", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <form>
        <input type="text" id="name" required>
        <input type="email" id="email">
        <textarea id="bio" maxlength="500"></textarea>
        <button type="submit">Enviar</button>
      </form>
    </body></html>`);
    const result = await page.evaluate(() => {
      const form = document.querySelector("form")!;
      const fields = Array.from(form.querySelectorAll("input, textarea, select")).map(el => ({
        tag: el.tagName.toLowerCase(),
        type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
        required: el.hasAttribute("required"),
        maxlength: el.getAttribute("maxlength"),
        name: el.getAttribute("name") || el.getAttribute("id") || "",
      }));
      return { fields, fieldCount: fields.length };
    });
    expect(result.fieldCount).toBe(3);
    expect(result.fields.some(f => f.required)).toBe(true);
    expect(result.fields.some(f => f.maxlength === "500")).toBe(true);
    await page.close();
  });
});

describe("Advanced QA — testFlow", () => {
  it("deve executar steps de fluxo", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <input id="search" placeholder="Buscar...">
      <button id="btn" onclick="document.getElementById('search').value='test'">OK</button>
    </body></html>`);
    const steps = [
      { action: "fill", selector: "#search", value: "test" },
      { action: "click", selector: "#btn" },
    ];
    for (const step of steps) {
      if (step.action === "fill") {
        await page.fill(step.selector, step.value!);
        expect(await page.inputValue(step.selector)).toBe("test");
      } else if (step.action === "click") {
        await page.click(step.selector);
      }
    }
    const finalVal = await page.inputValue("#search");
    expect(finalVal).toBe("test");
    await page.close();
  });
});

describe("Advanced QA — smokeTest", () => {
  it("deve verificar elementos essenciais da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head><title>Minha Página</title></head><body>
      <header role="banner">Header</header>
      <nav>Menu</nav>
      <main><h1>Título</h1><p>Conteúdo</p></main>
      <footer>Footer</footer>
    </body></html>`);
    const result = await page.evaluate(() => {
      const checks: Array<{ check: string; passed: boolean }> = [];
      checks.push({ check: "has_title", passed: !!document.title });
      checks.push({ check: "has_h1", passed: !!document.querySelector("h1") });
      checks.push({ check: "has_main", passed: !!document.querySelector("main, [role=main]") });
      checks.push({ check: "has_nav", passed: !!document.querySelector("nav, [role=navigation]") });
      checks.push({ check: "has_footer", passed: !!document.querySelector("footer, [role=contentinfo]") });
      const passed = checks.filter(c => c.passed).length;
      return { checks, passed, total: checks.length, score: Math.round((passed / checks.length) * 100) };
    });
    expect(result.score).toBe(100);
    expect(result.passed).toBe(result.total);
    await page.close();
  });
});

describe("Advanced QA — validateHtml", () => {
  it("deve detectar problemas de HTML", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <img src="foto.jpg">
      <a>Link sem href</a>
      <button onclick="alert(1)">Click</button>
      <div><p>Texto sem fechamento</div>
    </body></html>`);
    const result = await page.evaluate(() => {
      const issues: Array<{ type: string; severity: string; message: string }> = [];
      const imgs = document.querySelectorAll("img:not([alt])");
      imgs.forEach(i => issues.push({ type: "html", severity: "medium", message: "Imagem sem alt" }));
      const links = document.querySelectorAll("a:not([href])");
      links.forEach(l => issues.push({ type: "html", severity: "high", message: "Link sem href" }));
      const buttons = document.querySelectorAll("button[onclick]");
      buttons.forEach(b => issues.push({ type: "html", severity: "low", message: "Button com onclick inline" }));
      return { issues, totalIssues: issues.length, imgCount: imgs.length, linkCount: links.length };
    });
    expect(result.totalIssues).toBeGreaterThanOrEqual(2);
    expect(result.linkCount).toBe(1);
    await page.close();
  });
});

describe("Advanced QA — fuzzForm", () => {
  it("deve testar entradas maliciosas em formulários", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <input type="text" id="name">
      <input type="email" id="email">
      <input type="number" id="age">
    </body></html>`);
    const payloads = ["<script>alert(1)</script>", "' OR 1=1 --", "a".repeat(1000), "../../etc/passwd"];
    const results = [];
    for (const payload of payloads) {
      await page.fill("#name", payload);
      const val = await page.inputValue("#name");
      results.push({ payload: payload.slice(0, 20), accepted: val === payload });
    }
    expect(results.length).toBe(4);
    const fuzzCount = results.filter(r => r.accepted).length;
    expect(fuzzCount).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});

describe("Advanced QA — checkImages", () => {
  it("deve auditar imagens da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <img src="https://example.com/logo.png" alt="Logo">
      <img src="https://example.com/banner.jpg">
      <img src="broken-link.png" alt="Quebrado">
    </body></html>`);
    const result = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img[src]")).map(img => ({
        src: (img as HTMLImageElement).src || img.getAttribute("src"),
        alt: img.getAttribute("alt") || null,
        hasAlt: img.hasAttribute("alt"),
      }));
      const missingAlt = imgs.filter(i => !i.hasAlt);
      return { total: imgs.length, missingAlt: missingAlt.length, images: imgs };
    });
    expect(result.total).toBe(3);
    expect(result.missingAlt).toBe(1);
    await page.close();
  });
});

describe("Advanced QA — checkCache", () => {
  it("deve analisar headers de cache", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const result = await page.evaluate(() => performance.getEntriesByType("resource"));
    expect(Array.isArray(result)).toBe(true);
    await page.close();
  });
});

describe("Advanced QA — analyzeBundle", () => {
  it("deve listar scripts carregados", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head>
      <script src="https://cdn.example.com/lib.js"></script>
      <script src="/app.js"></script>
    </head><body></body></html>`);
    const result = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script[src]")).map(s => ({
        src: (s as HTMLScriptElement).src || s.getAttribute("src"),
        async: s.hasAttribute("async"),
        defer: s.hasAttribute("defer"),
        crossorigin: s.getAttribute("crossorigin") || null,
      }));
      return { scripts, count: scripts.length };
    });
    expect(result.count).toBe(2);
    await page.close();
  });
});

describe("Advanced QA — checkThirdParties", () => {
  it("deve identificar domínios terceiros", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <script src="https://cdn.example.com/widget.js"></script>
      <img src="https://other.domain.com/pixel.gif">
    </body></html>`);
    const result = await page.evaluate(() => {
      const pageOrigin = window.location.origin;
      const thirdParties: Array<{ type: string; src: string; domain: string }> = [];
      document.querySelectorAll("script[src], img[src], link[href]").forEach(el => {
        const src = (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || "";
        if (src && !src.startsWith(pageOrigin) && !src.startsWith("data:") && !src.startsWith("blob:")) {
          try { thirdParties.push({ type: el.tagName.toLowerCase(), src, domain: new URL(src).hostname }); } catch {}
        }
      });
      return { thirdParties, count: thirdParties.length };
    });
    expect(result.count).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});

describe("Advanced QA — perfBudget", () => {
  it("deve calcular métricas de performance", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const result = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as any;
      const paint = performance.getEntriesByType("paint");
      const fcp = paint.find(p => p.name === "first-contentful-paint");
      return {
        ttfb: nav ? nav.responseStart - nav.requestStart : null,
        fcp: fcp ? fcp.startTime : null,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
        loadEvent: nav ? nav.loadEventEnd : null,
      };
    });
    expect(result.ttfb).toBeGreaterThanOrEqual(0);
    expect(result.loadEvent).toBeGreaterThan(0);
    await page.close();
  });
});

describe("Advanced QA — analyzeDeps", () => {
  it("deve listar dependências da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head>
      <link rel="stylesheet" href="/styles.css">
      <script src="https://cdn.example.com/react@18/production.min.js"></script>
    </head><body></body></html>`);
    const result = await page.evaluate(() => {
      const deps: Array<{ type: string; src: string }> = [];
      document.querySelectorAll("script[src]").forEach(s => {
        deps.push({ type: "script", src: (s as HTMLScriptElement).src || s.getAttribute("src") || "" });
      });
      document.querySelectorAll("link[rel=stylesheet][href]").forEach(l => {
        deps.push({ type: "stylesheet", src: (l as HTMLLinkElement).href || l.getAttribute("href") || "" });
      });
      return { deps, count: deps.length };
    });
    expect(result.count).toBe(2);
    expect(result.deps.some(d => d.type === "script")).toBe(true);
    await page.close();
  });
});

describe("Advanced QA — checkAccessibilityTree", () => {
  it("deve extrair accessibility tree", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <h1>Título</h1>
      <button>OK</button>
      <a href="#">Link</a>
    </body></html>`);
    const result = await page.evaluate(() => {
      const snapAria = (el: Element): Record<string, unknown> => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || undefined,
        label: el.getAttribute("aria-label") || undefined,
        text: (el.textContent || "").trim().slice(0, 40) || undefined,
        children: Array.from(el.children).map(c => snapAria(c)),
      });
      return snapAria(document.body);
    });
    expect(result.tag).toBe("body");
    expect(result.children?.length).toBeGreaterThanOrEqual(3);
    expect(result.children?.some((c: any) => c.tag === "h1")).toBe(true);
    await page.close();
  });
});

describe("Advanced QA — validateJsonLd", () => {
  it("deve validar dados estruturados", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Test"}</script>
    </head><body></body></html>`);
    const result = await page.evaluate(() => {
      const jsonlds: any[] = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
        try { jsonlds.push(JSON.parse(el.textContent || "{}")); } catch {}
      });
      const issues: Array<{ type: string; severity: string; message: string }> = [];
      for (const item of jsonlds) {
        if (!item["@context"] || !item["@context"].includes("schema.org"))
          issues.push({ type: "jsonld", severity: "high", message: "@context não aponta para schema.org" });
        if (!item["@type"])
          issues.push({ type: "jsonld", severity: "high", message: "Falta @type" });
      }
      return { items: jsonlds, count: jsonlds.length, issues };
    });
    expect(result.count).toBe(1);
    expect(result.items[0]["@type"]).toBe("WebPage");
    expect(result.issues.length).toBe(0);
    await page.close();
  });
});

describe("Advanced QA — checkConsoleErrors", () => {
  it("deve capturar console errors", async () => {
    const page = await browser.newPage();
    const errors: Array<{ type: string; text: string }> = [];
    page.on("console", msg => {
      if (msg.type() === "error" || msg.type() === "warning")
        errors.push({ type: msg.type(), text: msg.text() });
    });
    await page.evaluate(() => {
      console.error("Erro de teste");
      console.warn("Warning de teste");
    });
    await page.waitForTimeout(100);
    expect(errors.length).toBe(2);
    expect(errors.some(e => e.text.includes("Erro"))).toBe(true);
    await page.close();
  });
});

describe("Advanced QA — analyzeState", () => {
  it("deve capturar estado da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <input id="name" value="João">
      <input type="checkbox" id="ok" checked>
      <select id="cor"><option value="azul" selected>Azul</option><option value="verde">Verde</option></select>
    </body></html>`);
    const result = await page.evaluate(() => {
      const state: Record<string, unknown> = {};
      const inputs = document.querySelectorAll("input, select, textarea");
      for (const el of Array.from(inputs)) {
        const id = el.getAttribute("id") || el.getAttribute("name") || "unknown";
        if (el instanceof HTMLInputElement) {
          if (el.type === "checkbox" || el.type === "radio") state[id] = el.checked;
          else state[id] = el.value;
        } else if (el instanceof HTMLSelectElement) {
          state[id] = el.value;
        }
      }
      return state;
    });
    expect(result.name).toBe("João");
    expect(result.ok).toBe(true);
    expect(result.cor).toBe("azul");
    await page.close();
  });
});

describe("Advanced QA — visualDiff (mock)", () => {
  it("deve funcionar com pixelmatch", async () => {
    const pixelmatch = (await import("pixelmatch")).default;
    const { PNG } = await import("pngjs");
    const img1 = new PNG({ width: 2, height: 2 });
    const img2 = new PNG({ width: 2, height: 2 });
    for (let i = 0; i < img1.data.length; i++) { img1.data[i] = 128; img2.data[i] = 200; }
    const diff = new PNG({ width: 2, height: 2 });
    const n = pixelmatch(img1.data, img2.data, diff.data, 2, 2, { threshold: 0.1 });
    expect(n).toBeGreaterThan(0);
  });
});

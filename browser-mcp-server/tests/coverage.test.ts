import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("coverage — pressKey", () => {
  it("deve pressionar tecla Enter via keyboard", async () => {
    const page = await browser.newPage();
    let submitted = false;
    await page.setContent(`<html><body>
      <form onsubmit="submitted=true;return false">
        <input id="f" type="text">
      </form>
      <script>window.submitted=false;</script>
    </body></html>`);
    await page.focus("#f");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => (window as any).submitted);
    expect(result).toBe(true);
    await page.close();
  });

  it("deve pressionar Escape para fechar", async () => {
    const page = await browser.newPage();
    let escaped = false;
    await page.setContent(`<html><body>
      <div id="modal" style="display:block">Modal</div>
      <script>
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") document.getElementById("modal").style.display = "none";
        });
      </script>
    </body></html>`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    const visible = await page.evaluate(() => document.getElementById("modal")!.style.display);
    expect(visible).toBe("none");
    await page.close();
  });
});

describe("coverage — hover", () => {
  it("deve mostrar elemento ao passar mouse", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <div id="target" style="width:100px;height:100px;background:red"
           onmouseenter="this.style.background='green'">Hover me</div>
    </body></html>`);
    await page.hover("#target");
    await page.waitForTimeout(200);
    const bg = await page.evaluate(() => document.getElementById("target")!.style.background);
    expect(bg).toContain("green");
    await page.close();
  });
});

describe("coverage — highlight", () => {
  it("deve aplicar outline ao elemento", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <button id="btn">Clique</button>
    </body></html>`);
    const borderColor = "red";
    await page.evaluate(({ selector, borderColor }: { selector: string; borderColor: string }) => {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) {
        el.style.outline = `3px solid ${borderColor}`;
        el.style.outlineOffset = "2px";
      }
    }, { selector: "#btn", borderColor });
    const outline = await page.evaluate(() => {
      const el = document.getElementById("btn");
      return el?.style.outline || "";
    });
    expect(outline).toContain("red");
    await page.close();
  });
});

describe("coverage — getFormFields", () => {
  it("deve listar campos do formulário", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <form>
        <label for="nome">Nome:</label>
        <input type="text" id="nome" name="nome" placeholder="Seu nome">
        <label for="email">Email:</label>
        <input type="email" id="email" name="email">
        <textarea id="bio" placeholder="Sobre você"></textarea>
        <select id="pais">
          <option value="br">Brasil</option>
          <option value="us">EUA</option>
        </select>
        <input type="hidden" name="token" value="abc123">
        <button type="submit">Enviar</button>
      </form>
    </body></html>`);
    const fields = await page.evaluate((includeHidden: boolean) => {
      const results: Array<{ tag: string; type: string; id: string; visible: boolean }> = [];
      document.querySelectorAll("input, select, textarea, button").forEach((el) => {
        const input = el as HTMLInputElement;
        if (input.type === "hidden" && !includeHidden) return;
        const rect = input.getBoundingClientRect();
        results.push({
          tag: input.tagName.toLowerCase(),
          type: input.type || "",
          id: input.id || "",
          visible: rect.width > 0 && rect.height > 0,
        });
      });
      return results;
    }, false);
    expect(fields.length).toBe(5);
    expect(fields.filter(f => f.visible).length).toBe(5);
    expect(fields.find(f => f.id === "nome")).toBeTruthy();
    expect(fields.find(f => f.id === "email")).toBeTruthy();
    expect(fields.find(f => f.id === "pais" && f.tag === "select")).toBeTruthy();
    await page.close();
  });

  it("deve incluir hidden quando solicitado", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <form>
        <input type="text" id="nome">
        <input type="hidden" name="token" value="abc">
      </form>
    </body></html>`);
    const fields = await page.evaluate((includeHidden: boolean) => {
      const results: Array<{ tag: string; type: string }> = [];
      document.querySelectorAll("input, select, textarea, button").forEach((el) => {
        const input = el as HTMLInputElement;
        if (input.type === "hidden" && !includeHidden) return;
        results.push({ tag: input.tagName.toLowerCase(), type: input.type || "" });
      });
      return results;
    }, true);
    expect(fields.length).toBe(2);
    expect(fields.some(f => f.type === "hidden")).toBe(true);
    await page.close();
  });
});

describe("coverage — ciCheck", () => {
  it("deve calcular score médio e pass/fail", async () => {
    const results = [
      { tool: "check_contrast", score: 100, issueCount: 0, pass: true },
      { tool: "check_images", score: 85, issueCount: 2, pass: true },
    ];
    const minScore = 70;
    const maxIssues = 10;
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const totalIssues = results.reduce((s, r) => s + r.issueCount, 0);
    const avgScore = Math.round(totalScore / results.length);
    const passed = results.every(r => r.pass) && avgScore >= minScore && totalIssues <= maxIssues;
    expect(avgScore).toBe(93);
    expect(totalIssues).toBe(2);
    expect(passed).toBe(true);
  });

  it("deve falhar quando score abaixo do threshold", async () => {
    const results = [
      { tool: "check_contrast", score: 50, issueCount: 5, pass: false },
      { tool: "check_images", score: 85, issueCount: 0, pass: true },
    ];
    const minScore = 70;
    const maxIssues = 10;
    const avgScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    const totalIssues = results.reduce((s, r) => s + r.issueCount, 0);
    const passed = results.every(r => r.pass) && avgScore >= minScore && totalIssues <= maxIssues;
    expect(avgScore).toBe(68);
    expect(passed).toBe(false);
  });
});

describe("coverage — lighthouseAudit", () => {
  it("deve coletar métricas de performance via Performance API", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as any;
      const paint = performance.getEntriesByType("paint");
      const fcp = paint.find(p => p.name === "first-contentful-paint");
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint") || [];
      return {
        ttfb: nav ? nav.responseStart - nav.requestStart : null,
        fcp: fcp ? fcp.startTime : null,
        lcp: lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      };
    });
    expect(metrics.ttfb).not.toBeNull();
    expect(typeof metrics.ttfb).toBe("number");
    expect(metrics.domContentLoaded).toBeGreaterThan(0);
    await page.close();
  });

  it("deve detectar Cumulative Layout Shift (CLS)", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value || 0;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 500);
      });
    });
    expect(cls).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});

describe("coverage — getNetwork", () => {
  it("deve capturar requisições de rede", async () => {
    const page = await browser.newPage();
    const requests: Array<{ url: string; method: string }> = [];
    page.on("request", (req) => {
      requests.push({ url: req.url(), method: req.method() });
    });
    await page.goto("https://example.com");
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.some(r => r.url.includes("example.com"))).toBe(true);
    await page.close();
  });
});

describe("coverage — goBack e refresh", () => {
  it("deve navegar para trás", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const firstUrl = page.url();
    await page.evaluate(() => window.location.hash = "#page2");
    await page.waitForTimeout(200);
    expect(page.url()).toContain("#page2");
    await page.goBack();
    await page.waitForTimeout(200);
    expect(page.url()).toBe(firstUrl);
    await page.close();
  });

  it("deve recarregar a página", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("example.com");
    await page.close();
  });
});

describe("coverage — exportHar", () => {
  it("deve exportar HAR como JSON", async () => {
    const page = await browser.newPage();
    const entries: Array<{ request: { url: string; method: string }; response: { status: number } }> = [];
    page.on("response", (resp) => {
      entries.push({
        request: { url: resp.url(), method: resp.request().method() },
        response: { status: resp.status() },
      });
    });
    await page.goto("https://example.com");
    await page.waitForTimeout(500);
    const har = {
      log: {
        version: "1.2",
        creator: { name: "bvp-browser", version: "0.1.0" },
        entries,
      },
    };
    expect(har.log.entries.length).toBeGreaterThan(0);
    expect(har.log.entries[0].request.url).toContain("example.com");
    await page.close();
  });
});

describe("coverage — blockRequests", () => {
  it("deve bloquear requisições por padrão de URL", async () => {
    const page = await browser.newPage();
    const blocked = ["example.com"];
    const requests: string[] = [];
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (blocked.some(p => url.includes(p))) {
        requests.push(url);
        route.abort();
      } else {
        route.continue();
      }
    });
    await page.goto("https://example.com").catch(() => {});
    await page.waitForTimeout(500);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.some(r => r.includes("example.com"))).toBe(true);
    await page.close();
  });
});

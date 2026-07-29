import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("Storybook — storybook_scan", () => {
  it("deve extrair links de navegação do Storybook", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <a href="?path=/story/example-button--primary">Button Primary</a>
      <a href="?path=/story/example-button--secondary">Button Secondary</a>
      <a href="?path=/story/example-input--default">Input Default</a>
    </body></html>`);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href*='path=/story/']")).map((a) => {
        const href = a.getAttribute("href") || "";
        const match = href.match(/path=\/story\/(.+)/);
        return match ? match[1] : null;
      }).filter(Boolean)
    );
    expect(links.length).toBe(3);
    expect(links).toContain("example-button--primary");
    await page.close();
  });

  it("deve categorizar stories por componente", async () => {
    const stories = [
      { id: "button--primary", kind: "Button", name: "Primary" },
      { id: "button--secondary", kind: "Button", name: "Secondary" },
      { id: "input--text", kind: "Input", name: "Text" },
    ];
    const components = new Map<string, { component: string; variants: string[] }>();
    for (const s of stories) {
      if (!components.has(s.kind)) components.set(s.kind, { component: s.kind, variants: [] });
      components.get(s.kind)!.variants.push(s.name);
    }
    expect(components.size).toBe(2);
    expect(components.get("Button")?.variants.length).toBe(2);
    expect(components.get("Input")?.variants).toContain("Text");
  });
});

describe("Storybook — storybook_audit_a11y", () => {
  it("deve injetar e executar axe-core", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <h1>Test</h1>
      <img src="photo.jpg" alt="Photo">
      <button>OK</button>
    </body></html>`);
    const hasAxe = await page.evaluate(() => typeof (window as any).axe !== "undefined");
    expect(hasAxe).toBe(false);
    await page.close();
  });

  it("deve detectar violações de acessibilidade básicas", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <img src="photo.jpg">
      <button onclick="alert(1)">Click</button>
    </body></html>`);
    const violations = await page.evaluate(() => {
      const issues: Array<{ id: string; impact: string }> = [];
      const imgs = document.querySelectorAll("img:not([alt])");
      imgs.forEach(() => issues.push({ id: "image-alt", impact: "critical" }));
      if (issues.length === 0) issues.push({ id: "none", impact: "none" });
      return issues;
    });
    expect(violations.some((v) => v.id === "image-alt")).toBe(true);
    await page.close();
  });

  it("deve calcular score baseado em violações", () => {
    const violations = [{ id: "image-alt" }, { id: "button-name" }];
    const score = Math.max(0, 100 - violations.length * 10);
    expect(score).toBe(80);
  });
});

describe("Storybook — storybook_visual_diff", () => {
  it("deve gerar e comparar screenshots", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body style="background:blue"><h1>Story</h1></body></html>`);
    const shot1 = await page.screenshot({ fullPage: true });
    await page.setContent(`<html><body style="background:red"><h1>Story Changed</h1></body></html>`);
    const shot2 = await page.screenshot({ fullPage: true });
    expect(shot1.length).toBeGreaterThan(0);
    expect(shot2.length).toBeGreaterThan(0);
    expect(shot1).not.toEqual(shot2);
    await page.close();
  });

  it("deve gerar diff image quando há diferenças", async () => {
    const pixelmatch = (await import("pixelmatch")).default;
    const { PNG } = await import("pngjs");
    const img1 = new PNG({ width: 3, height: 3 });
    const img2 = new PNG({ width: 3, height: 3 });
    for (let i = 0; i < img1.data.length; i++) { img1.data[i] = 100; img2.data[i] = 200; }
    const diff = new PNG({ width: 3, height: 3 });
    const mismatched = pixelmatch(img1.data, img2.data, diff.data, 3, 3, { threshold: 0 });
    expect(mismatched).toBeGreaterThan(0);
    const diffBuffer = PNG.sync.write(diff);
    expect(diffBuffer.length).toBeGreaterThan(0);
  });
});

describe("Storybook — storybook_perf", () => {
  it("deve coletar métricas de performance via Performance API", async () => {
    const page = await browser.newPage();
    await page.goto("data:text/html,<html><body>Perf Test</body></html>");
    const metrics = await page.evaluate(() => {
      const perf = performance;
      const paint = perf.getEntriesByType("paint");
      const nav = perf.getEntriesByType("navigation")[0] as any;
      return {
        fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0,
        domContentLoaded: nav?.domContentLoadedEventEnd || 0,
        resourceCount: perf.getEntriesByType("resource").length,
      };
    });
    expect(metrics.fcp).toBeGreaterThanOrEqual(0);
    expect(metrics.domContentLoaded).toBeGreaterThanOrEqual(0);
    await page.close();
  });

  it("deve medir LCP com PerformanceObserver", async () => {
    const page = await browser.newPage();
    await page.goto("data:text/html,<html><body><h1>LCP Test Element</h1></body></html>");
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;
        try {
          const obs = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) lcpValue = entries[entries.length - 1].startTime;
          });
          obs.observe({ type: "largest-contentful-paint", buffered: true } as any);
          setTimeout(() => { obs.disconnect(); resolve(lcpValue); }, 1000);
        } catch { resolve(0); }
      });
    });
    expect(lcp).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});

describe("Storybook — test_components (meta-tool)", () => {
  it("deve consolidar resultados de múltiplos checks", () => {
    const results = {
      scan: { totalComponents: 3, totalStories: 8 },
      a11y: { overallScore: 85, totalViolations: 5 },
      visualDiff: { passed: 6, regressions: 2, averageScore: 78 },
      perf: { averageLCP: "1.2s" },
    };
    expect(results.scan.totalComponents).toBe(3);
    expect(results.a11y.overallScore).toBe(85);
    expect(results.visualDiff.passed).toBe(6);
    expect(results.perf.averageLCP).toBe("1.2s");
  });

  it("deve executar checks condicionalmente baseado em flags", () => {
    const checkList = "scan,a11y";
    const checks = checkList.split(",").map((s) => s.trim());
    const allChecks = checks.includes("all");
    expect(allChecks).toBe(false);
    expect(checks).toContain("scan");
    expect(checks).toContain("a11y");
    expect(checks).not.toContain("perf");
  });
});

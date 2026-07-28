import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("QA — test_visual_regression", () => {
  it("deve criar baseline na primeira execução", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body style="background:red"><h1>Test</h1></body></html>`);
    const name = "vitest_baseline_create";
    const baseDir = path.join(os.tmpdir(), "bvp-visual-baselines");
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
    const baselinePath = path.join(baseDir, `${name}.png`);
    if (fs.existsSync(baselinePath)) fs.unlinkSync(baselinePath);

    const screenshot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(baselinePath, screenshot);
    expect(fs.existsSync(baselinePath)).toBe(true);

    const stats = fs.statSync(baselinePath);
    expect(stats.size).toBeGreaterThan(0);

    if (fs.existsSync(baselinePath)) fs.unlinkSync(baselinePath);
    if (fs.existsSync(baseDir)) fs.rmdirSync(baseDir);
    await page.close();
  });

  it("deve detectar diferenças entre screenshots", async () => {
    const img1 = new PNG({ width: 4, height: 4 });
    const img2 = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < img1.data.length; i++) {
      img1.data[i] = 128;
      img2.data[i] = 200;
    }
    const diff = new PNG({ width: 4, height: 4 });
    const n = pixelmatch(img1.data, img2.data, diff.data, 4, 4, { threshold: 0.1 });
    expect(n).toBeGreaterThan(0);
  });

  it("deve retornar identical para imagens iguais", async () => {
    const img1 = new PNG({ width: 4, height: 4 });
    const img2 = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < img1.data.length; i++) img1.data[i] = img2.data[i] = 128;
    const diff = new PNG({ width: 4, height: 4 });
    const n = pixelmatch(img1.data, img2.data, diff.data, 4, 4, { threshold: 0.1 });
    expect(n).toBe(0);
  });
});

describe("QA — test_mobile_suite", () => {
  it("deve detectar overflow horizontal em viewport estreita", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><div style="width:2000px;height:10px">Wide content</div></body></html>`);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    const overflowX = await page.evaluate(() => document.body ? document.body.scrollWidth > window.innerWidth : false);
    expect(overflowX).toBe(true);
    await page.close();
  });

  it("deve detectar touch targets pequenos em mobile", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><button style="width:30px;height:30px">X</button></body></html>`);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    const small = await page.evaluate(() => {
      const btns = document.querySelectorAll("button, a");
      let count = 0;
      for (const el of Array.from(btns)) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) count++;
      }
      return count;
    });
    expect(small).toBeGreaterThan(0);
    await page.close();
  });

  it("deve listar font-sizes usados na página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><p style="font-size:10px">Small</p><p style="font-size:20px">Big</p></body></html>`);
    const sizes = await page.evaluate(() => {
      const els = document.querySelectorAll("*");
      const set = new Set<number>();
      for (const el of Array.from(els)) {
        const sz = parseFloat(window.getComputedStyle(el).fontSize);
        if (!isNaN(sz) && sz > 0) set.add(sz);
      }
      return Array.from(set).sort((a, b) => a - b);
    });
    expect(sizes).toContain(10);
    expect(sizes).toContain(20);
    await page.close();
  });
});

describe("QA — test_cross_browser", () => {
  it("deve navegar em chromium e obter título", async () => {
    const b2 = await chromium.launch({ headless: true });
    const ctx = await b2.newContext();
    const page = await ctx.newPage();
    await page.goto("data:text/html,<title>CrossBrowser Test</title><h1>Hello</h1>");
    const title = await page.title();
    expect(title).toBe("CrossBrowser Test");
    await b2.close();
  });

  it("deve coletar performance metrics", async () => {
    const b2 = await chromium.launch({ headless: true });
    const page = await b2.newPage();
    await page.goto("data:text/html,<html><body>Perf Test</body></html>");
    const perf = await page.evaluate(() => {
      const perf = performance;
      const paint = perf.getEntriesByType("paint");
      return {
        fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0,
        resources: perf.getEntriesByType("resource").length,
      };
    });
    expect(perf.fcp).toBeGreaterThanOrEqual(0);
    await b2.close();
  });
});

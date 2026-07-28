import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("DEV/UI — front_components", () => {
  it("deve detectar elementos com data-reactroot", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <div id="root" data-reactroot="">
        <div class="_component">React App</div>
      </div>
    </body></html>`);
    const hasReact = await page.evaluate(() => {
      return !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
        document.querySelectorAll('[data-reactroot]').length > 0;
    });
    expect(hasReact).toBe(true);
    await page.close();
  });

  it("deve detectar elementos Vue com atributos data-v-*", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <div data-v-abc123 class="component">
        <span data-v-abc123>Vue Component</span>
      </div>
    </body></html>`);
    const vueEls = await page.evaluate(() => {
      let count = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        for (const attr of el.attributes) {
          if (attr.name.startsWith("data-v-")) { count++; break; }
        }
      }
      return count;
    });
    expect(vueEls).toBeGreaterThan(0);
    await page.close();
  });

  it("deve detectar Angular com ng-version", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <app-root ng-version="17.0.0">
        <div ng-reflect-something="value">Angular Component</div>
      </app-root>
    </body></html>`);
    const ngEls = await page.evaluate(() => document.querySelectorAll("[ng-version], [ng-app]").length);
    expect(ngEls).toBeGreaterThan(0);
    await page.close();
  });

  it("deve detectar Web Components (custom elements)", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <my-button variant="primary">Click</my-button>
      <my-card>
        <my-title>Card Title</my-title>
      </my-card>
    </body></html>`);
    const customs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("*")).filter((el) => el.tagName.includes("-"))
    );
    expect(customs.length).toBe(3);
    await page.close();
  });
});

describe("DEV/UI — ui_design_system", () => {
  it("deve extrair cores da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head><style>
      h1 { color: #ff0000; background: #fff; }
      p { color: #333; }
    </style></head><body>
      <h1 style="color:rgb(255,0,0);background:rgb(255,255,255)">Title</h1>
      <p style="color:rgb(51,51,51)">Text</p>
    </body></html>`);
    const colors = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      const set = new Set<string>();
      for (const el of Array.from(all)) {
        const s = window.getComputedStyle(el);
        if (s.color) set.add(s.color);
        if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") set.add(s.backgroundColor);
      }
      return Array.from(set);
    });
    expect(colors.length).toBeGreaterThanOrEqual(2);
    await page.close();
  });

  it("deve extrair fontes e tamanhos", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head><style>
      body { font-family: Arial, sans-serif; }
      h1 { font-size: 32px; }
      p { font-size: 16px; }
    </style></head><body>
      <h1>Title</h1>
      <p>Paragraph</p>
    </body></html>`);
    const data = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
      const fonts = new Set<string>();
      const sizes = new Set<number>();
      for (const el of Array.from(all)) {
        const s = window.getComputedStyle(el);
        const ff = s.fontFamily?.split(",")[0]?.replace(/["']/g, "").trim();
        if (ff) fonts.add(ff);
        const fs = parseFloat(s.fontSize);
        if (!isNaN(fs) && fs > 0) sizes.add(fs);
      }
      return { fonts: Array.from(fonts), sizes: Array.from(sizes).sort() };
    });
    expect(data.fonts).toContain("Arial");
    expect(data.sizes).toContain(32);
    await page.close();
  });

  it("deve extrair border-radius", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <div style="border-radius: 8px; width: 100px; height: 50px; background: red;">Rounded</div>
    </body></html>`);
    const br = await page.evaluate(() => {
      const div = document.querySelector("div");
      if (!div) return null;
      return parseFloat(window.getComputedStyle(div).borderRadius);
    });
    expect(br).toBe(8);
    await page.close();
  });

  it("deve extrair CSS custom properties", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head><style>
      :root { --primary: #007bff; --font-size-base: 16px; }
    </style></head><body><h1>Test</h1></body></html>`);
    const props = await page.evaluate(() => {
      const result: Record<string, string> = {};
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop && prop.startsWith("--")) result[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        } catch {}
      }
      return result;
    });
    expect(props["--primary"]).toBe("#007bff");
    expect(props["--font-size-base"]).toBe("16px");
    await page.close();
  });
});

describe("DEV/UI — ui_responsive_matrix", () => {
  it("deve detectar overflow em viewport pequena", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><div style="width:2000px">Wide content</div></body></html>`);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    const overflowX = await page.evaluate(() => document.body ? document.body.scrollWidth > window.innerWidth : false);
    expect(overflowX).toBe(true);
    await page.close();
  });

  it("deve funcionar em viewport desktop sem overflow", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><div style="width:800px">Normal content</div></body></html>`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(200);
    const overflowX = await page.evaluate(() => document.body ? document.body.scrollWidth > window.innerWidth : false);
    expect(overflowX).toBe(false);
    await page.close();
  });

  it("deve medir hidden elements em diferentes viewports", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <nav style="display:none">Mobile menu</nav>
      <main>Content</main>
      <footer style="display:none">Mobile footer</footer>
    </body></html>`);
    const hidden = await page.evaluate(() => {
      const all = document.querySelectorAll("body *");
      let count = 0;
      for (const el of Array.from(all)) {
        const s = window.getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") count++;
      }
      return count;
    });
    expect(hidden).toBeGreaterThanOrEqual(2);
    await page.close();
  });
});

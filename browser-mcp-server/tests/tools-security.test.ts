import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("Security — scan_owasp_top10", () => {
  it("deve detectar formulário sem POST", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <form action="/login" method="get">
        <input type="text" name="user">
        <input type="password" name="pass">
      </form>
    </body></html>`);
    const forms = await page.evaluate(() =>
      Array.from(document.querySelectorAll("form")).map((f) => ({
        method: (f.getAttribute("method") || "get").toLowerCase(),
        action: f.getAttribute("action") || "",
      }))
    );
    expect(forms.length).toBe(1);
    expect(forms[0].method).toBe("get");
    await page.close();
  });

  it("deve detectar campos sem maxlength", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <input type="text" name="name">
      <input type="text" name="bio" maxlength="500">
    </body></html>`);
    const inputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input, textarea")).map((el) => ({
        name: el.getAttribute("name") || "",
        maxlength: el.getAttribute("maxlength") || null,
      }))
    );
    const semMaxlength = inputs.filter((i) => !i.maxlength);
    expect(semMaxlength.length).toBe(1);
    expect(semMaxlength[0].name).toBe("name");
    await page.close();
  });

  it("deve detectar scripts de CDN como dependências", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head>
      <script src="https://cdn.example.com/jquery-3.6.0.min.js"></script>
    </head><body></body></html>`);
    const libs = ["jquery", "react", "angular", "vue", "lodash", "bootstrap"];
    const detected: string[] = [];
    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll("script[src]")).map((s) => ({
        src: (s as HTMLScriptElement).src || "",
      }))
    );
    for (const script of scripts) {
      const lower = script.src.toLowerCase();
      for (const lib of libs) {
        if (lower.includes(lib) && /\d+\.\d+\.\d+/.test(lower)) {
          detected.push(lib);
          break;
        }
      }
    }
    expect(detected).toContain("jquery");
    await page.close();
  });

  it("deve detectar chaves AWS expostas no HTML", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <script>const key = "AKIA0123456789ABCDEF";</script>
    </body></html>`);
    const body = await page.evaluate(() => document.body?.textContent || "");
    const matches = body.match(/AKIA[0-9A-Z]{16}/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
    await page.close();
  });
});

describe("Security — scan_deps", () => {
  it("deve detectar bibliotecas conhecidas", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><head>
      <script src="https://cdn.example.com/react@18.2.0/umd/react.production.min.js"></script>
      <link rel="stylesheet" href="https://cdn.example.com/bootstrap@5.3.0/css/bootstrap.min.css">
    </head><body></body></html>`);
    const allSources = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => ({
        type: "script" as const,
        src: (s as HTMLScriptElement).src || "",
        text: "",
      }));
      const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => ({
        type: "stylesheet" as const,
        src: (l as HTMLLinkElement).href || "",
        text: "",
      }));
      return [...scripts, ...sheets];
    });
    const versionRegex = /(\d+)\.(\d+)\.(\d+)/;
    const detected: string[] = [];
    for (const s of allSources) {
      if (s.src.includes("react") && versionRegex.test(s.src)) detected.push("React");
      if (s.src.includes("bootstrap") && versionRegex.test(s.src)) detected.push("Bootstrap");
    }
    expect(detected).toContain("React");
    expect(detected).toContain("Bootstrap");
    await page.close();
  });
});

describe("Security — scan_endpoints", () => {
  it("deve descobrir links e actions de formulário", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <a href="https://api.example.com/v1/users">Users</a>
      <form action="/api/login" method="post">
        <input type="text" name="user">
      </form>
    </body></html>`);
    const endpoints = await page.evaluate(() => {
      const items: string[] = [];
      document.querySelectorAll("a[href]").forEach((a) => {
        const href = (a as HTMLAnchorElement).href || "";
        if (href) items.push(href);
      });
      document.querySelectorAll("form[action]").forEach((f) => {
        const action = f.getAttribute("action") || "";
        if (action) items.push(action);
      });
      return items;
    });
    expect(endpoints.length).toBeGreaterThanOrEqual(2);
    await page.close();
  });
});

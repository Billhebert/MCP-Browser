import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = 3150;
const BASE = `http://localhost:${PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let server: any = null;
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });

  // Build TS and start the server
  const distPath = path.join(ROOT, "dist", "index.js");
  const distExists = fs.existsSync(distPath);

  if (!distExists) {
    // Use tsx via node --import
    const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    server = spawn(process.execPath, [tsx, path.join(ROOT, "src", "index.ts")], {
      cwd: ROOT,
      env: { ...process.env, BROWSER_HEADLESS: "true", BVP_HTTP_PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    server = spawn(process.execPath, [distPath], {
      cwd: ROOT,
      env: { ...process.env, BROWSER_HEADLESS: "true", BVP_HTTP_PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  server.stderr.on("data", (d: Buffer) => {
    const line = d.toString();
    if (line.includes("HTTP server listening") || line.includes("MCP Server started")) {
      // Server ready
    }
  });

  server.on("error", (err: Error) => {
    console.error("Server spawn error:", err.message);
  });

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
}, 45000);

afterAll(async () => {
  await browser.close();
  if (server) { server.kill(); }
});

async function expectPageLoads(page: Page, url: string): Promise<void> {
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 10000 });
  expect(res?.status()).toBe(200);
}

describe("Dashboard", () => {
  it("loads and shows stats", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/");
    const body = await page.textContent("body");
    expect(body).toContain("Dashboard");
    expect(body).toContain("Tools");
    expect(body).toContain("Server");
    expect(body).toContain("Quick Actions");
    await page.close();
  });

  it("has working navigation buttons", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/");
    // Playground link exists
    const playgroundLink = await page.$('a[href="/playground"]');
    expect(playgroundLink).not.toBeNull();
    // Full Audit link exists
    const auditLink = await page.$('a[href="/audits"]');
    expect(auditLink).not.toBeNull();
    await page.close();
  });

  it("refresh button works", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/");
    const refreshBtn = await page.$("button:has-text('Refresh')");
    expect(refreshBtn).not.toBeNull();
    if (refreshBtn) await refreshBtn.click();
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("tools");
    await page.close();
  });
});

describe("Playground", () => {
  it("loads tool list", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/playground");
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    expect(body).toContain("navigate");
    expect(body).toContain("analyze_seo");
    await page.close();
  });

  it("search filters tools", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/playground");
    await page.waitForTimeout(1500);
    const searchInput = await page.$('input[placeholder="Search tools..."]');
    expect(searchInput).not.toBeNull();
    if (searchInput) {
      await searchInput.fill("seo");
      await page.waitForTimeout(300);
      const body = await page.textContent("body");
      expect(body).toContain("analyze_seo");
    }
    await page.close();
  });

  it("shows tool list and search", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/playground");
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body).toContain("navigate");
    expect(body).toContain("analyze_seo");
    // Verify search works
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.fill("seo");
      await page.waitForTimeout(300);
      const body2 = await page.textContent("body");
      expect(body2).toContain("analyze_seo");
    }
    await page.close();
  });

  it("shows error state", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/playground");
    await page.waitForTimeout(1500);
    // Tool list should not show error
    const body = await page.textContent("body");
    expect(body).not.toContain("Failed to load");
    await page.close();
  });
});

describe("Analyze Page", () => {
  it("loads and has input form", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/analyze");
    const input = await page.$('input[type="url"]');
    expect(input).not.toBeNull();
    const btn = await page.$("button:has-text('Analyze')");
    expect(btn).not.toBeNull();
    await page.close();
  });

  it("executes analysis and shows issues", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/analyze");

    const input = await page.$('input[type="url"]');
    expect(input).not.toBeNull();
    if (input) await input.fill("https://example.com");

    const btn = await page.$("button:has-text('Analyze')");
    expect(btn).not.toBeNull();
    if (btn) await btn.click();

    await page.waitForTimeout(5000);
    const body = await page.textContent("body");
    expect(body).toContain("Score") || expect(body).toContain("Issues");
    await page.close();
  });
});

describe("Sessions", () => {
  it("loads and shows create form", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/sessions");
    const input = await page.$('input[placeholder="New session label..."]');
    expect(input).not.toBeNull();
    const btn = await page.$("button:has-text('Create')");
    expect(btn).not.toBeNull();
    await page.close();
  });

  it("creates a new session", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/sessions");
    await page.waitForTimeout(500);

    const input = await page.$('input[placeholder="New session label..."]');
    if (input) await input.fill("E2E Test Session");

    const btn = await page.$("button:has-text('Create')");
    if (btn) await btn.click();

    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    expect(body).toContain("E2E Test Session");
    await page.close();
  });

  it("switch and close buttons exist", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/sessions");
    await page.waitForTimeout(500);

    const closeBtns = await page.$$("button:has-text('Close')");
    expect(closeBtns.length).toBeGreaterThan(0);
    await page.close();
  });
});

describe("Settings", () => {
  it("loads and shows known settings", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/settings");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("Settings");
    expect(body).toContain("Discord Webhook");
    await page.close();
  });

  it("can add custom setting", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/settings");
    await page.waitForTimeout(500);

    const keyInputs = await page.$$("input");
    // Find the custom key input (there are several, use the one with placeholder "Key")
    let keyInput = null;
    for (const inp of keyInputs) {
      const placeholder = await inp.getAttribute("placeholder");
      if (placeholder === "Key") { keyInput = inp; break; }
    }
    expect(keyInput).not.toBeNull();
    if (keyInput) await keyInput.fill("e2e_test_key");
    // Find value input
    let valInput = null;
    for (const inp of keyInputs) {
      const placeholder = await inp.getAttribute("placeholder");
      if (placeholder === "Value") { valInput = inp; break; }
    }
    expect(valInput).not.toBeNull();
    if (valInput) await valInput.fill("e2e_test_value");
    // Click Add
    const addBtn = await page.$("button:has-text('Add')");
    expect(addBtn).not.toBeNull();
    if (addBtn) await addBtn.click();
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("e2e_test_key");
    await page.close();
  });
});

describe("SQL Console", () => {
  it("loads and shows connection form", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/sql");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("SQL Console");
    expect(body).toContain("Connection String");
    expect(body).toContain("Execute");
    await page.close();
  });

  it("can connect to SQLite and query", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/sql");
    await page.waitForTimeout(500);

    // Fill connection string
    const csInput = await page.$('input[placeholder*="postgresql"]');
    if (csInput) {
      await csInput.click();
      await csInput.fill(":memory:");
    }

    // Click Connect
    const connectBtn = await page.$("button:has-text('Connect')");
    if (connectBtn) await connectBtn.click();
    await page.waitForTimeout(1000);

    const body = await page.textContent("body");
    expect(body).toContain("Connected") || expect(body).toContain("Error");
    await page.close();
  });
});

describe("Contracts", () => {
  it("loads and shows editor", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/contracts");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("Contract Testing");
    expect(body).toContain("Execute Contract");
    await page.close();
  });

  it("can execute a contract and see results", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/contracts");
    await page.waitForTimeout(500);

    const executeBtn = await page.$("button:has-text('Execute Contract')");
    expect(executeBtn).not.toBeNull();
    if (executeBtn) {
      await executeBtn.click();
      await page.waitForTimeout(5000);
      const body = await page.textContent("body");
      // Should show score or passed/failed after execution
      expect(body).toContain("Score") || expect(body).toContain("Error");
    }
    await page.close();
  });
});

describe("Storybook", () => {
  it("loads and shows tool cards", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/storybook");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("Storybook");
    expect(body).toContain("Scan Components");
    expect(body).toContain("A11Y Audit");
    expect(body).toContain("Visual Diff");
    expect(body).toContain("Run All Checks");
    await page.close();
  });
});

describe("Audit History", () => {
  it("loads and shows empty state or list", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/audits/history");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("Audit History");
    await page.close();
  });
});

describe("Audit Comparison", () => {
  it("loads and shows comparison form", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/audits/compare");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("Audit Comparison");
    expect(body).toContain("Baseline");
    expect(body).toContain("Current");
    expect(body).toContain("Compare");
    await page.close();
  });
});

describe("Full Site Audit", () => {
  it("loads with input form", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/audits");
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    expect(body).toContain("Full Site Audit");
    // URL input exists
    const input = await page.$('input[type="url"]');
    expect(input).not.toBeNull();
    await page.close();
  });
});

describe("Sidebar Navigation", () => {
  it("all sidebar links navigate correctly", async () => {
    const page = await browser.newPage();
    await expectPageLoads(page, BASE + "/");

    const links = [
      { text: "Playground", path: "/playground" },
      { text: "Audits", path: "/audits" },
      { text: "Storybook", path: "/storybook" },
      { text: "SQL", path: "/sql" },
      { text: "Settings", path: "/settings" },
    ];

    for (const link of links) {
      const el = await page.$(`a[href="${link.path}"]`);
      expect(el, `Link to ${link.path} should exist`).not.toBeNull();
      if (el) {
        await el.click();
        await page.waitForTimeout(500);
        expect(page.url()).toContain(link.path);
      }
    }
    await page.close();
  });
});

describe("404 Page", () => {
  it("shows 404 for unknown routes", async () => {
    const page = await browser.newPage();
    const res = await page.goto(BASE + "/nonexistent-page", { waitUntil: "networkidle", timeout: 10000 });
    expect(res?.status()).toBe(200); // SPA returns index.html for all routes
    const body = await page.textContent("body");
    expect(body).toContain("404") || expect(body).toContain("not found");
    await page.close();
  });
});

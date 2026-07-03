import { chromium } from "playwright";

const BASE = "http://localhost:5173";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 1. Navigate to app
  console.log("1. Navigating to", BASE);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/bvp-01-home.png" });
  console.log("   Screenshot: /tmp/bvp-01-home.png");

  // 2. Login form
  console.log("2. Filling login form...");

  // Fill Usuário (placeholder "admin")
  await page.locator('input[placeholder="admin"]').first().fill("admin");
  await sleep(200);

  // Fill Senha (placeholder "Admin@1234", type=password)
  await page.locator('input[placeholder="Admin@1234"]').fill("Admin@1234");
  await sleep(200);

  // Click "Entrar" button
  await page.locator('button:has-text("Entrar")').first().click();

  // Wait for navigation
  await sleep(1500);
  await page.waitForLoadState("networkidle");
  await sleep(1000);
  await page.screenshot({ path: "/tmp/bvp-02-after-login.png" });
  console.log("   Screenshot: /tmp/bvp-02-after-login.png");

  // Check if login succeeded
  const stillLogin = await page.locator('input[type="password"]').count();
  if (stillLogin > 0) {
    console.log("   Login might have failed — still seeing password field.");
  } else {
    console.log("   Login appears successful!");
  }

  // 3. Try Kanban
  console.log("3. Navigating to Kanban...");
  const kanbanLink = page.locator('a:has-text("Kanban"), button:has-text("Kanban"), span:has-text("Kanban")').first();
  if (await kanbanLink.count() > 0) {
    await kanbanLink.click();
    await sleep(1500);
    await page.screenshot({ path: "/tmp/bvp-03-kanban.png" });
    console.log("   Screenshot: /tmp/bvp-03-kanban.png");
  } else {
    console.log("   Kanban link not found, trying /kanban directly");
    await page.goto(BASE + "/kanban", { waitUntil: "networkidle" });
    await sleep(1000);
    await page.screenshot({ path: "/tmp/bvp-03-kanban.png" });
    console.log("   Screenshot: /tmp/bvp-03-kanban.png");
  }

  // 4. Try Plugins
  console.log("4. Navigating to Plugins...");
  const pluginsLink = page.locator('a:has-text("Plugin"), button:has-text("Plugin")').first();
  if (await pluginsLink.count() > 0) {
    await pluginsLink.click();
    await sleep(1500);
    await page.screenshot({ path: "/tmp/bvp-04-plugins.png" });
    console.log("   Screenshot: /tmp/bvp-04-plugins.png");
  } else {
    console.log("   Plugins link not found, trying /plugins directly");
    await page.goto(BASE + "/plugins", { waitUntil: "networkidle" });
    await sleep(1000);
    await page.screenshot({ path: "/tmp/bvp-04-plugins.png" });
    console.log("   Screenshot: /tmp/bvp-04-plugins.png");
  }

  // 5. Logout
  console.log("5. Logging out...");
  const signOutBtn = page.locator('button:has-text("Sign Out")').first();
  if (await signOutBtn.count() > 0) {
    await signOutBtn.click();
    await sleep(1000);
    await page.screenshot({ path: "/tmp/bvp-05-after-logout.png" });
    console.log("   Screenshot: /tmp/bvp-05-after-logout.png");
    const backToLogin = await page.locator('input[type="password"]').count();
    if (backToLogin > 0) {
      console.log("   Logout successful — login form is visible again.");
    } else {
      console.log("   Logout may not have returned to login form.");
    }
  } else {
    console.log("   Sign Out button not found.");
  }

  // 6. API health check through Vite proxy
  console.log("6. Testing API through Vite proxy...");
  try {
    const response = await page.request.post(BASE + "/api/auth/login", {
      data: { userId: "admin", password: "Admin@1234", tenantId: "t1", role: "owner" }
    });
    const data = await response.json();
    if (data.accessToken) {
      console.log("   API login OK");
      const pingResp = await page.request.get(BASE + "/api/plugins/hello-world/ping", {
        headers: { Authorization: "Bearer " + data.accessToken }
      });
      const pingData = await pingResp.json();
      console.log("   Ping response:", JSON.stringify(pingData));
    } else {
      console.log("   API login failed:", JSON.stringify(data));
    }
  } catch (e) {
    console.log("   API test error:", e.message);
  }

  await browser.close();
  console.log("\n=== E2E Test Complete ===");
}

main().catch((err) => {
  console.error("E2E Test Error:", err);
  process.exit(1);
});

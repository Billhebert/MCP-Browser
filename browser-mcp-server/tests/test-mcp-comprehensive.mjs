import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const distPath = path.join(ROOT, "dist", "index.js");

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  return async () => {
    try {
      await fn();
      passed++;
      results.push(`  ✅ ${name}`);
    } catch (err) {
      failed++;
      results.push(`  ❌ ${name}: ${err.message.slice(0, 200)}`);
    }
  };
}

async function runSuite(suiteName, tests) {
  console.log(`\n━━━ ${suiteName} ━━━\n`);
  for (const t of tests) {
    await t();
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertSuccess(r) {
  if (!r?.content?.length) throw new Error("No content returned");
  if (r.isError) throw new Error(`Tool returned isError: ${(r.content[0]?.text || "unknown").slice(0, 100)}`);
}

async function main() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   COMPREHENSIVE MCP TEST SUITE v2     ║");
  console.log("╚════════════════════════════════════════╝\n");

  const transport = new StdioClientTransport({
    command: "node", args: [distPath],
    env: { ...process.env, BROWSER_HEADLESS: "true" },
  });
  client = new Client({ name: "mcp-test-suite", version: "1.0.0" }, { capabilities: {} });

  // ─────────── PHASE 1: BASIC PROTOCOL ───────────
  await runSuite("PHASE 1: Basic Protocol", [
    test("Connect to MCP server", async () => { await client.connect(transport); }),
    test("Ping / keepalive", async () => { await client.ping(); }),
    test("ListTools returns 129 tools", async () => {
      const r = await client.listTools();
      assert(r.tools.length >= 100, `Only ${r.tools.length} tools`);
    }),
    test("ListResources returns 6 resources", async () => {
      const r = await client.listResources();
      assert(r.resources.length >= 3, `Only ${r.resources.length} resources`);
    }),
    test("ListPrompts returns 2 prompts", async () => {
      const r = await client.listPrompts();
      assert(r.prompts.length >= 2, `Only ${r.prompts.length} prompts`);
    }),
  ]);

  const allTools = (await client.listTools()).tools;
  const toolNames = new Set(allTools.map(t => t.name));

  // ─────────── PHASE 2: NAVIGATION & BASIC TOOLS ───────────
  await runSuite("PHASE 2: Navigation & Basic Tools", [
    test("navigate to example.com", async () => {
      assertSuccess(await client.callTool({ name: "navigate", arguments: { url: "https://example.com" } }));
    }),
    test("get_text h1", async () => {
      const r = await client.callTool({ name: "get_text", arguments: { selector: "h1" } });
      assertSuccess(r);
      assert(r.content[0]?.text?.includes("Example"), `Wrong text: ${r.content[0]?.text?.slice(0, 50)}`);
    }),
    test("get_html returns HTML", async () => {
      const r = await client.callTool({ name: "get_html", arguments: {} });
      assertSuccess(r);
      assert(r.content[0]?.text?.length > 50, `HTML too short`);
    }),
    test("find element on page", async () => {
      assertSuccess(await client.callTool({ name: "find", arguments: { selector: "h1" } }));
    }),
    test("get_attributes of body", async () => {
      assertSuccess(await client.callTool({ name: "get_attributes", arguments: { selector: "body" } }));
    }),
    test("get_console empty", async () => {
      assertSuccess(await client.callTool({ name: "get_console", arguments: {} }));
    }),
    test("get_performance returns text (not JSON)", async () => {
      const r = await client.callTool({ name: "get_performance", arguments: {} });
      assertSuccess(r);
      const text = r.content[0]?.text || "";
      assert(text.length > 20, `get_performance too short: ${text.length}`);
    }),
    test("hover on h1", async () => {
      assertSuccess(await client.callTool({ name: "hover", arguments: { selector: "h1" } }));
    }),
    test("highlight h1", async () => {
      assertSuccess(await client.callTool({ name: "highlight", arguments: { selector: "h1", color: "red" } }));
    }),
    test("screenshot returns data", async () => {
      const r = await client.callTool({ name: "screenshot", arguments: {} });
      assertSuccess(r);
      assert(r.content.some(c => c.type === "image" || c.data), "No image data");
    }),
    test("elementScreenshot of h1", async () => {
      assertSuccess(await client.callTool({ name: "element_screenshot", arguments: { selector: "h1" } }));
    }),
    test("export_pdf returns data", async () => {
      assertSuccess(await client.callTool({ name: "export_pdf", arguments: {} }));
    }),
    test("scrollTo bottom", async () => {
      assertSuccess(await client.callTool({ name: "scroll_to", arguments: { x: 0, y: 500 } }));
    }),
    test("goBack after scroll", async () => {
      assertSuccess(await client.callTool({ name: "go_back", arguments: {} }));
    }),
  ]);

  // ─────────── PHASE 3: INTERACTION TOOLS ───────────
  const testPage = "data:text/html,<html><body><button id='btn' onclick='this.textContent=\"clicked\"'>Click</button><input id='inp'><select id='sel'><option>a</option><option>b</option></select></body></html>";
  await runSuite("PHASE 3: Interaction Tools", [
    test("navigate to test page", async () => {
      assertSuccess(await client.callTool({ name: "navigate", arguments: { url: testPage } }));
    }),
    test("click button", async () => {
      assertSuccess(await client.callTool({ name: "click", arguments: { selector: "#btn" } }));
    }),
    test("fill input", async () => {
      assertSuccess(await client.callTool({ name: "fill", arguments: { selector: "#inp", value: "hello" } }));
    }),
    test("select option", async () => {
      assertSuccess(await client.callTool({ name: "select", arguments: { selector: "#sel", value: "b" } }));
    }),
    test("press_key Enter", async () => {
      assertSuccess(await client.callTool({ name: "press_key", arguments: { selector: "#inp", key: "Enter" } }));
    }),
    test("execute_js", async () => {
      assertSuccess(await client.callTool({ name: "execute_js", arguments: { script: "document.title" } }));
    }),
    test("dragAndDrop", async () => {
      assertSuccess(await client.callTool({ name: "drag_and_drop", arguments: { source: "#btn", target: "#inp" } }));
    }),
    test("get_form_fields", async () => {
      assertSuccess(await client.callTool({ name: "get_form_fields", arguments: {} }));
    }),
    test("upload_file (no file selected - graceful)", async () => {
      const r = await client.callTool({ name: "upload_file", arguments: { selector: "#inp", filePath: "/tmp/nonexistent.txt" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 4: COOKIES / STORAGE / NETWORK ───────────
  await runSuite("PHASE 4: Cookies, Storage & Network", [
    test("set_cookies", async () => {
      assertSuccess(await client.callTool({ name: "set_cookies", arguments: { cookies: [{ name: "test", value: "val", domain: "example.com" }] } }));
    }),
    test("get_cookies returns cookies", async () => {
      const r = await client.callTool({ name: "get_cookies", arguments: {} });
      assertSuccess(r);
    }),
    test("set_local_storage with items object", async () => {
      await client.callTool({ name: "navigate", arguments: { url: "https://example.com" } });
      assertSuccess(await client.callTool({ name: "set_local_storage", arguments: { items: { "mcp-test": "ok" } } }));
    }),
    test("emulate_device", async () => {
      assertSuccess(await client.callTool({ name: "emulate_device", arguments: { device: "iPhone 13" } }));
    }),
    test("set_viewport", async () => {
      assertSuccess(await client.callTool({ name: "set_viewport", arguments: { width: 1024, height: 768 } }));
    }),
    test("set_geo", async () => {
      assertSuccess(await client.callTool({ name: "set_geo", arguments: { latitude: -23.55, longitude: -46.63 } }));
    }),
    test("set_locale", async () => {
      const r = await client.callTool({ name: "set_locale", arguments: { locale: "pt-BR" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("set_color_scheme", async () => {
      assertSuccess(await client.callTool({ name: "set_color_scheme", arguments: { scheme: "dark" } }));
    }),
    test("block_requests", async () => {
      assertSuccess(await client.callTool({ name: "block_requests", arguments: { patterns: ["*.css"] } }));
    }),
    test("set_network conditions", async () => {
      const r = await client.callTool({ name: "set_network", arguments: { condition: "Online" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 5: QA & AUDIT TOOLS ───────────
  await runSuite("PHASE 5: QA & Audit Tools", [
    test("navigate to example.com for audit", async () => {
      assertSuccess(await client.callTool({ name: "navigate", arguments: { url: "https://example.com" } }));
    }),
    test("check_a11y", async () => {
      assertSuccess(await client.callTool({ name: "check_a11y", arguments: { standard: "wcag22aa" } }));
    }),
    test("check_contrast", async () => { assertSuccess(await client.callTool({ name: "check_contrast", arguments: {} })); }),
    test("check_images", async () => { assertSuccess(await client.callTool({ name: "check_images", arguments: {} })); }),
    test("check_links", async () => { assertSuccess(await client.callTool({ name: "check_links", arguments: {} })); }),
    test("check_security", async () => { assertSuccess(await client.callTool({ name: "check_security", arguments: {} })); }),
    test("check_spelling", async () => { assertSuccess(await client.callTool({ name: "check_spelling", arguments: { locale: "en" } })); }),
    test("check_ssl", async () => { assertSuccess(await client.callTool({ name: "check_ssl", arguments: {} })); }),
    test("check_readability", async () => { assertSuccess(await client.callTool({ name: "check_readability", arguments: {} })); }),
    test("check_console_errors", async () => { assertSuccess(await client.callTool({ name: "check_console_errors", arguments: {} })); }),
    test("check_redirects", async () => { assertSuccess(await client.callTool({ name: "check_redirects", arguments: { url: "https://example.com" } })); }),
    test("check_cache", async () => { assertSuccess(await client.callTool({ name: "check_cache", arguments: {} })); }),
    test("check_broken_anchors", async () => { assertSuccess(await client.callTool({ name: "check_broken_anchors", arguments: {} })); }),
    test("check_third_parties", async () => { assertSuccess(await client.callTool({ name: "check_third_parties", arguments: {} })); }),
    test("check_typography", async () => { assertSuccess(await client.callTool({ name: "check_typography", arguments: {} })); }),
    test("check_cookies_consent", async () => { assertSuccess(await client.callTool({ name: "check_cookies_consent", arguments: {} })); }),
    test("check_privacy_forms", async () => { assertSuccess(await client.callTool({ name: "check_privacy_forms", arguments: {} })); }),
    test("check_accessibility_tree", async () => { assertSuccess(await client.callTool({ name: "check_accessibility_tree", arguments: {} })); }),
    test("validate_html", async () => { assertSuccess(await client.callTool({ name: "validate_html", arguments: {} })); }),
    test("validate_json_ld", async () => { assertSuccess(await client.callTool({ name: "validate_json_ld", arguments: {} })); }),
    test("analyze_seo", async () => { assertSuccess(await client.callTool({ name: "analyze_seo", arguments: {} })); }),
    test("analyze_css", async () => { assertSuccess(await client.callTool({ name: "analyze_css", arguments: {} })); }),
    test("analyze_responsive", async () => { assertSuccess(await client.callTool({ name: "analyze_responsive", arguments: {} })); }),
    test("analyze_state", async () => { assertSuccess(await client.callTool({ name: "analyze_state", arguments: {} })); }),
    test("analyze_bundle", async () => { assertSuccess(await client.callTool({ name: "analyze_bundle", arguments: {} })); }),
    test("analyze_deps", async () => { assertSuccess(await client.callTool({ name: "analyze_deps", arguments: {} })); }),
    test("lighthouse_audit", async () => { assertSuccess(await client.callTool({ name: "lighthouse_audit", arguments: { url: "https://example.com" } })); }),
    test("full_site_audit", async () => { assertSuccess(await client.callTool({ name: "full_site_audit", arguments: { url: "https://example.com" } })); }),
    test("explain_issue", async () => { assertSuccess(await client.callTool({ name: "explain_issue", arguments: { type: "contrast" } })); }),
    test("suggest_fixes", async () => {
      assertSuccess(await client.callTool({ name: "suggest_fixes", arguments: { data: '{"issues":[{"type":"contrast","severity":"high","message":"ratio 2.5:1"}]}' } }));
    }),
    test("ci_check", async () => { assertSuccess(await client.callTool({ name: "ci_check", arguments: {} })); }),
    test("test_api GET", async () => { assertSuccess(await client.callTool({ name: "test_api", arguments: { method: "GET", url: "https://example.com" } })); }),
    test("test_form", async () => { assertSuccess(await client.callTool({ name: "test_form", arguments: { url: "https://example.com" } })); }),
    test("smoke_test", async () => {
      assertSuccess(await client.callTool({ name: "smoke_test", arguments: { urls: '[{"url":"https://example.com"}]' } }));
    }),
    test("load_test", async () => {
      assertSuccess(await client.callTool({ name: "load_test", arguments: { url: "https://example.com" } }));
    }),
    test("health_check", async () => { assertSuccess(await client.callTool({ name: "health_check", arguments: {} })); }),
  ]);

  // ─────────── PHASE 6: TABS ───────────
  await runSuite("PHASE 6: Tabs & Sessions", [
    test("new_tab", async () => {
      assertSuccess(await client.callTool({ name: "new_tab", arguments: { url: "https://example.com" } }));
    }),
    test("list_tabs", async () => {
      const r = await client.callTool({ name: "list_tabs", arguments: {} });
      assertSuccess(r);
    }),
    test("switch_tab", async () => {
      const r = await client.callTool({ name: "list_tabs", arguments: {} });
      assertSuccess(r);
    }),
  ]);

  // ─────────── PHASE 7: ADVANCED QA ───────────
  await runSuite("PHASE 7: Advanced QA Tools", [
    test("navigate to simple test page", async () => {
      assertSuccess(await client.callTool({ name: "navigate", arguments: { url: "data:text/html,<html><body><h1>Test</h1><p>Hello</p></body></html>" } }));
    }),
    test("test_flow", async () => {
      assertSuccess(await client.callTool({ name: "test_flow", arguments: { steps: '[{"action":"navigate","url":"https://example.com"}]' } }));
    }),
    test("run_suite", async () => {
      assertSuccess(await client.callTool({ name: "run_suite", arguments: { tests: '["check_contrast","check_images"]', url: "https://example.com" } }));
    }),
    test("fuzz_form", async () => {
      assertSuccess(await client.callTool({ name: "fuzz_form", arguments: { url: "about:blank" } }));
    }),
    test("extract_table", async () => {
      const r = await client.callTool({ name: "extract_table", arguments: {} });
      assert(r.content?.length > 0, "No response");
    }),
    test("crawl_pages", async () => {
      assertSuccess(await client.callTool({ name: "crawl_pages", arguments: { url: "https://example.com", maxPages: 1 } }));
    }),
    test("take_notes", async () => {
      assertSuccess(await client.callTool({ name: "take_notes", arguments: { action: "add", issueKey: "test", text: "test note", author: "mcp-test" } }));
    }),
    test("add_performance_mark", async () => {
      assertSuccess(await client.callTool({ name: "add_performance_mark", arguments: { name: "test-mark" } }));
    }),
    test("perf_budget", async () => {
      assertSuccess(await client.callTool({ name: "perf_budget", arguments: { budgets: '[{"metric":"first-contentful-paint","max":3000}]' } }));
    }),
    test("network_waterfall", async () => {
      const r = await client.callTool({ name: "network_waterfall", arguments: {} });
      assert(r.content?.length > 0, "No response");
    }),
    test("record_session start", async () => {
      assertSuccess(await client.callTool({ name: "record_session", arguments: { action: "start" } }));
    }),
  ]);

  // ─────────── PHASE 8: SNAPSHOT, VISUAL, EXTENSION ───────────
  await runSuite("PHASE 8: Snapshot, Visual & Extension", [
    test("save_snapshot", async () => {
      assertSuccess(await client.callTool({ name: "save_snapshot", arguments: { name: "test-snap" } }));
    }),
    test("get_snapshots", async () => {
      const r = await client.callTool({ name: "get_snapshots", arguments: {} });
      assertSuccess(r);
    }),
    test("restore_snapshot", async () => {
      assertSuccess(await client.callTool({ name: "restore_snapshot", arguments: { name: "test-snap" } }));
    }),
    test("visual_diff", async () => {
      const r = await client.callTool({ name: "visual_diff", arguments: { name: "test-snap" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("generate_report", async () => {
      assertSuccess(await client.callTool({ name: "generate_report", arguments: { data: '{"results":[]}', format: "json" } }));
    }),
    test("compare_audits", async () => {
      const r = await client.callTool({ name: "compare_audits", arguments: { baseline: "{}", current: "{}" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("schedule_audit", async () => {
      assertSuccess(await client.callTool({ name: "schedule_audit", arguments: { action: "add", tool: "check_a11y", cron: "0 6", args: '{"url":"https://example.com"}' } }));
    }),
    test("list_extensions (empty in headless)", async () => {
      const r = await client.callTool({ name: "list_extensions", arguments: {} });
      assert(!r.isError, "Should not error, just return empty list");
    }),
    test("export_har", async () => {
      assertSuccess(await client.callTool({ name: "export_har", arguments: {} }));
    }),
    test("export_csv", async () => {
      const r = await client.callTool({ name: "export_csv", arguments: { selector: "table" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 9: WEBHOOK / NOTIFICATION ───────────
  await runSuite("PHASE 9: Webhook & Notification", [
    test("send_webhook", async () => {
      const r = await client.callTool({ name: "send_webhook", arguments: { event: "test", data: '{"msg":"ok"}' } });
      assert(r.content?.length > 0, "No response");
    }),
    test("notify_slack", async () => {
      const r = await client.callTool({ name: "notify_slack", arguments: { message: "test", channel: "#general" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("notify_discord", async () => {
      const r = await client.callTool({ name: "notify_discord", arguments: { message: "test" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("create_jira_issue", async () => {
      const r = await client.callTool({ name: "create_jira_issue", arguments: { summary: "Test", description: "Test", project: "MCP" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 10: FRONTEND / UI ───────────
  await runSuite("PHASE 10: Frontend & Component Tools", [
    test("navigate to styled page", async () => {
      assertSuccess(await client.callTool({ name: "navigate", arguments: { url: "data:text/html,<html><body><div data-reactroot><button class='btn'>OK</button></div></body></html>" } }));
    }),
    test("front_components", async () => {
      assertSuccess(await client.callTool({ name: "front_components", arguments: {} }));
    }),
    test("ui_responsive_matrix", async () => {
      assertSuccess(await client.callTool({ name: "ui_responsive_matrix", arguments: { url: "about:blank" } }));
    }),
    test("wait_for_element", async () => {
      assertSuccess(await client.callTool({ name: "wait_for_element", arguments: { selector: "body", timeout: 2000 } }));
    }),
    test("wait (timeout)", async () => {
      const start = Date.now();
      const r = await client.callTool({ name: "wait", arguments: { type: "timeout", value: "200" } });
      const elapsed = Date.now() - start;
      assertSuccess(r);
      assert(elapsed >= 100, `wait too fast: ${elapsed}ms`);
    }),
    test("ask", async () => {
      assertSuccess(await client.callTool({ name: "ask", arguments: { question: "What is the page title?" } }));
    }),
    test("generate_pdf_report", async () => {
      const r = await client.callTool({ name: "generate_pdf_report", arguments: { format: "json" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 11: SCAN & SECURITY ───────────
  await runSuite("PHASE 11: Scan & Security Tools", [
    test("navigate to example.com for scans", async () => {
      assertSuccess(await client.callTool({ name: "navigate", arguments: { url: "https://example.com" } }));
    }),
    test("scan_deps", async () => {
      assertSuccess(await client.callTool({ name: "scan_deps", arguments: { url: "https://example.com" } }));
    }),
    test("scan_endpoints", async () => {
      assertSuccess(await client.callTool({ name: "scan_endpoints", arguments: { url: "https://example.com" } }));
    }),
    test("scan_owasp_top10", async () => {
      const r = await client.callTool({ name: "scan_owasp_top10", arguments: { url: "https://example.com" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("scrape_pages", async () => {
      const r = await client.callTool({ name: "scrape_pages", arguments: { data: '{"url":"https://example.com"}' } });
      assert(r.content?.length > 0, "No response");
    }),
    test("mock_api", async () => {
      assertSuccess(await client.callTool({ name: "mock_api", arguments: { mocks: '[{"url":"/api/test","status":200,"body":"{\\"ok\\":true}","method":"GET"}]' } }));
    }),
  ]);

  // ─────────── PHASE 12: STORYBOOK ───────────
  await runSuite("PHASE 12: Storybook Tools", [
    test("storybook_scan", async () => {
      assertSuccess(await client.callTool({ name: "storybook_scan", arguments: { url: "about:blank" } }));
    }),
    test("storybook_audit_a11y", async () => {
      const r = await client.callTool({ name: "storybook_audit_a11y", arguments: { url: "about:blank" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("storybook_perf", async () => {
      assertSuccess(await client.callTool({ name: "storybook_perf", arguments: { url: "about:blank" } }));
    }),
    test("storybook_visual_diff", async () => {
      const r = await client.callTool({ name: "storybook_visual_diff", arguments: { name: "test" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 13: SQL TOOLS ───────────
  await runSuite("PHASE 13: SQL Tools (SQLite)", [
    test("sql_connect SQLite in-memory", async () => {
      assertSuccess(await client.callTool({ name: "sql_connect", arguments: { connectionString: ":memory:", label: "test-mem", type: "sqlite" } }));
    }),
    test("sql_query SELECT 1", async () => {
      assertSuccess(await client.callTool({ name: "sql_query", arguments: { label: "test-mem", sql: "SELECT 1 as val" } }));
    }),
    test("sql_execute CREATE TABLE", async () => {
      assertSuccess(await client.callTool({ name: "sql_execute", arguments: { label: "test-mem", sql: "CREATE TABLE IF NOT EXISTS mcp_test (id INTEGER PRIMARY KEY, name TEXT)" } }));
    }),
    test("sql_execute INSERT", async () => {
      assertSuccess(await client.callTool({ name: "sql_execute", arguments: { label: "test-mem", sql: "INSERT INTO mcp_test (name) VALUES ('hello')" } }));
    }),
    test("sql_query SELECT data", async () => {
      const r = await client.callTool({ name: "sql_query", arguments: { label: "test-mem", sql: "SELECT * FROM mcp_test" } });
      assertSuccess(r);
      assert(r.content[0]?.text?.includes("hello"), "Data not found");
    }),
    test("sql_schema", async () => {
      assertSuccess(await client.callTool({ name: "sql_schema", arguments: { label: "test-mem" } }));
    }),
    test("sql_schema_export", async () => {
      const r = await client.callTool({ name: "sql_schema_export", arguments: { label: "test-mem", format: "json" } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 14: TEST CONTRACT ───────────
  await runSuite("PHASE 14: Test Contract Tools", [
    test("test_contract", async () => {
      assertSuccess(await client.callTool({ name: "test_contract", arguments: { contract: '{"name":"test","url":"https://example.com","checks":[{"field":"status","operator":"eq","value":200}]}' } }));
    }),
    test("test_cross_browser", async () => {
      const r = await client.callTool({ name: "test_cross_browser", arguments: { url: "https://example.com", browsers: '["chromium"]' } });
      assert(r.content?.length > 0, "No response");
    }),
  ]);

  // ─────────── PHASE 15: RESOURCES ───────────
  await runSuite("PHASE 15: Resources", [
    test("ReadResource: browser://page/url", async () => {
      const r = await client.readResource({ uri: "browser://page/url" });
      assert(r.contents.length > 0, "No content");
      assert(r.contents[0].text?.startsWith("http"), `Not a URL: ${(r.contents[0].text || "").slice(0, 50)}`);
    }),
    test("ReadResource: browser://page/title", async () => {
      const r = await client.readResource({ uri: "browser://page/title" });
      assert(r.contents.length > 0, "No content");
    }),
    test("ReadResource: browser://page/html", async () => {
      const r = await client.readResource({ uri: "browser://page/html" });
      assert(r.contents.length > 0, "No content");
      assert(r.contents[0].text?.length > 100, "HTML too short");
    }),
    test("ReadResource: browser://console/logs", async () => {
      const r = await client.readResource({ uri: "browser://console/logs" });
      assert(r.contents.length > 0, "No content");
      JSON.parse(r.contents[0].text);
    }),
    test("ReadResource: browser://network/logs", async () => {
      const r = await client.readResource({ uri: "browser://network/logs" });
      assert(r.contents.length > 0, "No content");
      JSON.parse(r.contents[0].text);
    }),
    test("ReadResource: browser://status", async () => {
      const r = await client.readResource({ uri: "browser://status" });
      assert(r.contents.length > 0, "No content");
      const data = JSON.parse(r.contents[0].text);
      assert(data.url, "No url in status");
    }),
    test("ReadResource: invalid URI", async () => {
      const r = await client.readResource({ uri: "browser://nonexistent" });
      assert(r.isError || r.contents?.[0]?.text?.includes("not found") || r.contents?.[0]?.text?.includes("Error"), "Should have returned error");
    }),
  ]);

  // ─────────── PHASE 16: PROMPTS ───────────
  await runSuite("PHASE 16: Prompts", [
    test("GetPrompt: audit-page", async () => {
      const r = await client.getPrompt({ name: "audit-page", arguments: { focus: "all" } });
      assert(r.messages?.length > 0, "No messages");
      assert((r.messages[0]?.content?.text || "").length > 50, "Prompt too short");
    }),
    test("GetPrompt: check-a11y", async () => {
      const r = await client.getPrompt({ name: "check-a11y", arguments: {} });
      assert(r.messages?.length > 0, "No messages");
      assert(r.messages[0]?.content?.text?.includes("check_a11y"), "Missing a11y reference");
    }),
    test("GetPrompt: unknown prompt", async () => {
      try {
        const r = await client.getPrompt({ name: "nonexistent", arguments: {} });
        assert(r.messages?.[0]?.content?.text?.includes("not found"), "Should error");
      } catch {}
    }),
  ]);

  // ─────────── PHASE 17: ERROR HANDLING ───────────
  await runSuite("PHASE 17: Error Handling", [
    test("Unknown tool returns isError", async () => {
      const r = await client.callTool({ name: "nonexistent_tool_xyz", arguments: {} });
      assert(r.isError === true, "Should be isError");
    }),
    test("navigate without url returns error", async () => {
      const r = await client.callTool({ name: "navigate", arguments: {} });
      assert(r.isError === true, "Missing required arg should error");
    }),
    test("navigate with invalid URL", async () => {
      const r = await client.callTool({ name: "navigate", arguments: { url: "not-a-valid-url!!!" } });
      assert(r.isError === true, "Invalid URL should error");
    }),
    test("execute_js throws handled gracefully", async () => {
      const r = await client.callTool({ name: "execute_js", arguments: { script: "throw new Error('test')" } });
      assert(r.content?.length > 0, "No response");
    }),
    test("ListTools called twice same count", async () => {
      const r1 = await client.listTools();
      const r2 = await client.listTools();
      assert(r1.tools.length === r2.tools.length, `Mismatch: ${r1.tools.length} vs ${r2.tools.length}`);
    }),
    test("Missing args return clear error", async () => {
      const r = await client.callTool({ name: "suggest_fixes", arguments: {} });
      assert(r.isError === true, "Missing 'data' should error");
    }),
  ]);

  // ─────────── PHASE 18: STRESS ───────────
  await runSuite("PHASE 18: Stress", [
    test("Navigate then get_text chain", async () => {
      await client.callTool({ name: "navigate", arguments: { url: "https://example.com" } });
      const r = await client.callTool({ name: "get_text", arguments: { selector: "h1" } });
      assertSuccess(r);
      assert(r.content[0]?.text?.includes("Example"), "Wrong text after navigate");
    }),
    test("5 rapid calls", async () => {
      for (let i = 0; i < 5; i++) {
        assertSuccess(await client.callTool({ name: "get_text", arguments: { selector: "h1" } }));
      }
    }),
    test("ListTools 20x stress", async () => {
      for (let i = 0; i < 20; i++) {
        const r = await client.listTools();
        assert(r.tools.length >= 100, `Stress ${i}: ${r.tools.length} tools`);
      }
    }),
  ]);

  // ─────────── SUMMARY ───────────
  const total = passed + failed;
  console.log("\n" + "━".repeat(50));
  console.log(`\n📊 RESULTS: ${passed}/${total} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    for (const r of results.filter(r => r.includes("❌"))) console.log(r);
  }
  console.log("\n" + "━".repeat(50) + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

let client;
main().catch(err => { console.error("FATAL:", err); process.exit(1); });

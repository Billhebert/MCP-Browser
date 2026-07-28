import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const distPath = path.join(ROOT, "dist", "index.js");

async function test() {
  console.log("\n=== REAL MCP INTEGRATION TEST ===\n");

  const transport = new StdioClientTransport({
    command: "node",
    args: [distPath],
    env: { ...process.env, BROWSER_HEADLESS: "true" },
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );

  let exitCode = 0;

  try {
    await client.connect(transport);
    console.log("✅ Connected to MCP server\n");

    // 1. ListTools
    console.log("1️⃣  ListTools...");
    const toolsResult = await client.listTools();
    const toolCount = toolsResult.tools.length;
    console.log(`   Found ${toolCount} tools`);
    if (toolCount < 100) throw new Error(`Expected >=100 tools, got ${toolCount}`);
    console.log(`   ✅ ${toolCount} tools loaded`);

    // 2. ListResources
    console.log("\n2️⃣  ListResources...");
    const resourcesResult = await client.listResources();
    console.log(`   Found ${resourcesResult.resources.length} resources`);
    if (resourcesResult.resources.length < 3) throw new Error("Expected >=3 resources");
    for (const r of resourcesResult.resources) {
      console.log(`   - ${r.uri}: ${r.name}`);
    }
    console.log(`   ✅ Resources OK`);

    // 3. ListPrompts
    console.log("\n3️⃣  ListPrompts...");
    const promptsResult = await client.listPrompts();
    console.log(`   Found ${promptsResult.prompts.length} prompts`);
    if (promptsResult.prompts.length < 2) throw new Error("Expected >=2 prompts");
    for (const p of promptsResult.prompts) {
      console.log(`   - ${p.name}: ${p.description}`);
    }
    console.log(`   ✅ Prompts OK`);

    // 4. CallTool: navigate
    console.log("\n4️⃣  CallTool: navigate to example.com...");
    const navResult = await client.callTool({
      name: "navigate",
      arguments: { url: "https://example.com" },
    });
    const navText = navResult.content[0]?.text || "";
    if (navResult.isError) throw new Error(`navigate failed: ${navText}`);
    console.log(`   ✅ Navigated: ${navText.slice(0, 120)}`);

    // 5. CallTool: get_text
    console.log("\n5️⃣  CallTool: get_text...");
    const textResult = await client.callTool({
      name: "get_text",
      arguments: { selector: "h1" },
    });
    const pageText = textResult.content[0]?.text || "";
    if (textResult.isError) throw new Error(`get_text failed: ${pageText}`);
    console.log(`   ✅ Page H1: "${pageText.slice(0, 100)}"`);

    // 6. CallTool: screenshot
    console.log("\n6️⃣  CallTool: screenshot...");
    const ssResult = await client.callTool({
      name: "screenshot",
      arguments: {},
    });
    if (ssResult.isError) throw new Error("screenshot failed");
    const hasImage = ssResult.content.some(c => c.type === "image" || c.data);
    console.log(`   ✅ Screenshot captured (${hasImage ? "has image data" : "text response"})`);

    // 7. ReadResource: browser://status
    console.log("\n7️⃣  ReadResource: browser://status...");
    const statusRes = await client.readResource({ uri: "browser://status" });
    const statusData = JSON.parse(statusRes.contents[0].text);
    console.log(`   ✅ URL: ${statusData.url}, Console: ${statusData.consoleLogs}, Net: ${statusData.networkLogs}`);

    // 8. ReadResource: browser://page/title
    console.log("\n8️⃣  ReadResource: browser://page/title...");
    const titleRes = await client.readResource({ uri: "browser://page/title" });
    console.log(`   ✅ Title: "${titleRes.contents[0].text}"`);

    // 9. GetPrompt
    console.log("\n9️⃣  GetPrompt: audit-page...");
    const promptRes = await client.getPrompt({
      name: "audit-page",
      arguments: { focus: "a11y" },
    });
    const promptText = promptRes.messages[0]?.content?.text || "";
    if (!promptText) throw new Error("Prompt returned empty message");
    console.log(`   ✅ Prompt generated (${promptText.length} chars)`);

    // 10. Second tool call
    console.log("\n🔟 CallTool: get_network...");
    const netResult = await client.callTool({
      name: "get_network",
      arguments: {},
    });
    if (netResult.isError) throw new Error("get_network failed");
    console.log(`   ✅ Network logs: ${(netResult.content[0]?.text || "").slice(0, 100)}`);

    console.log("\n🎉🎉🎉 ALL 10 MCP TESTS PASSED! 🎉🎉🎉");
  } catch (err) {
    console.error(`\n❌ FAILED: ${err.message}`);
    exitCode = 1;
  } finally {
    await client.close().catch(() => {});
    process.exit(exitCode);
  }
}

test();

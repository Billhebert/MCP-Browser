import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { serialized } from "./browser.js";
import { loadWebhooks, sendWebhook } from "./corporate/webhook.js";
import { writeAudit, readAudits } from "./corporate/auditTrail.js";
import { checkRateLimit } from "./corporate/rateLimiter.js";
import { navigateTool } from "./tools/navigate.js";
import { clickTool } from "./tools/click.js";
import { fillTool } from "./tools/fill.js";
import { selectTool } from "./tools/select.js";
import { getTextTool } from "./tools/getText.js";
import { getHtmlTool } from "./tools/getHtml.js";
import { screenshotTool } from "./tools/screenshot.js";
import { waitTool } from "./tools/wait.js";
import { executeJsTool } from "./tools/executeJs.js";
import { goBackTool } from "./tools/goBack.js";
import { closeTool } from "./tools/close.js";
import { getConsoleTool } from "./tools/getConsole.js";
import { findTool } from "./tools/find.js";
import { getAttributesTool } from "./tools/getAttributes.js";
import { hoverTool } from "./tools/hover.js";
import { pressKeyTool } from "./tools/pressKey.js";
import { getNetworkTool } from "./tools/getNetwork.js";
import { getFormFieldsTool } from "./tools/getFormFields.js";
import { uploadFileTool } from "./tools/uploadFile.js";
import { scrollToTool } from "./tools/scrollTo.js";
import { refreshTool } from "./tools/refresh.js";
import { getCookiesTool } from "./tools/getCookies.js";
import { listTabsTool } from "./tools/listTabs.js";
import { switchTabTool } from "./tools/switchTab.js";
import { newTabTool } from "./tools/newTab.js";
import { dragAndDropTool } from "./tools/dragAndDrop.js";
import { saveSnapshotTool, getSnapshotsTool, restoreSnapshotTool } from "./tools/saveSnapshot.js";
import { highlightTool } from "./tools/highlight.js";
import { blockRequestsTool } from "./tools/blockRequests.js";
import { setGeoTool } from "./tools/setGeo.js";
import { askTool } from "./tools/ask.js";
import { setViewportTool } from "./tools/setViewport.js";
import { setColorSchemeTool } from "./tools/setColorScheme.js";
import { setLocaleTool } from "./tools/setLocale.js";
import { elementScreenshotTool } from "./tools/elementScreenshot.js";
import { getPerformanceTool } from "./tools/getPerformance.js";
import { exportHarTool } from "./tools/exportHar.js";
import { exportPdfTool } from "./tools/exportPdf.js";
import { setCookiesTool } from "./tools/setCookies.js";
import { setLocalStorageTool } from "./tools/setLocalStorage.js";
import { addPerformanceMarkTool } from "./tools/addPerformanceMark.js";
import { analyzeSeoTool } from "./tools/analyzeSeo.js";
import { checkLinksTool } from "./tools/checkLinks.js";
import { checkA11yTool } from "./tools/checkA11y.js";
import { checkSecurityTool } from "./tools/checkSecurity.js";
import { visualDiffTool } from "./tools/visualDiff.js";
import { analyzeCssTool } from "./tools/analyzeCss.js";
import { networkWaterfallTool } from "./tools/networkWaterfall.js";
import { testApiTool } from "./tools/testApi.js";
import { crawlPagesTool } from "./tools/crawlPages.js";
import { lighthouseAuditTool } from "./tools/lighthouseAudit.js";
import { loadTestTool } from "./tools/loadTest.js";
import { generateReportTool } from "./tools/generateReport.js";
import { checkContrastTool } from "./tools/checkContrast.js";
import { analyzeResponsiveTool } from "./tools/analyzeResponsive.js";
import { checkTypographyTool } from "./tools/checkTypography.js";
import { testFormTool } from "./tools/testForm.js";
import { testFlowTool } from "./tools/testFlow.js";
import { smokeTestTool } from "./tools/smokeTest.js";
import { validateHtmlTool } from "./tools/validateHtml.js";
import { fuzzFormTool } from "./tools/fuzzForm.js";
import { checkImagesTool } from "./tools/checkImages.js";
import { checkCacheTool } from "./tools/checkCache.js";
import { analyzeBundleTool } from "./tools/analyzeBundle.js";
import { checkThirdPartiesTool } from "./tools/checkThirdParties.js";
import { perfBudgetTool } from "./tools/perfBudget.js";
import { analyzeDepsTool } from "./tools/analyzeDeps.js";
import { checkAccessibilityTreeTool } from "./tools/checkAccessibilityTree.js";
import { validateJsonLdTool } from "./tools/validateJsonLd.js";
import { checkConsoleErrorsTool } from "./tools/checkConsoleErrors.js";
import { analyzeStateTool } from "./tools/analyzeState.js";
import { runSuiteTool } from "./tools/runSuite.js";
import { ciCheckTool } from "./tools/ciCheck.js";
import { suggestFixesTool } from "./tools/suggestFixes.js";
import { explainIssueTool } from "./tools/explainIssue.js";
import { emulateDeviceTool } from "./tools/emulateDevice.js";
import { setNetworkTool } from "./tools/setNetwork.js";
import { mockApiTool } from "./tools/mockApi.js";
import { recordSessionTool } from "./tools/recordSession.js";
import { checkReadabilityTool } from "./tools/checkReadability.js";
import { checkBrokenAnchorsTool } from "./tools/checkBrokenAnchors.js";
import { checkSpellingTool } from "./tools/checkSpelling.js";
import { checkCookiesConsentTool } from "./tools/checkCookiesConsent.js";
import { checkPrivacyFormsTool } from "./tools/checkPrivacyForms.js";
import { checkSslTool } from "./tools/checkSsl.js";
import { checkRedirectsTool } from "./tools/checkRedirects.js";
import { extractTableTool } from "./tools/extractTable.js";
import { exportPageDataTool } from "./tools/exportPageData.js";
import { healthCheckTool } from "./tools/healthCheck.js";
import { generatePdfReportTool } from "./tools/generatePdfReport.js";
import { sendWebhookTool } from "./tools/sendWebhook.js";
import { notifySlackTool } from "./tools/notifySlack.js";
import { createJiraIssueTool } from "./tools/createJiraIssue.js";
import { compareAuditsTool } from "./tools/compareAudits.js";
import { scheduleAuditTool } from "./tools/scheduleAudit.js";
import { takeNotesTool } from "./tools/takeNotes.js";

export interface ToolDefinition {
  name: string;
  description: string;
  args: Record<string, z.ZodType>;
  execute: (args: any) => Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
  }>;
}

const tools: ToolDefinition[] = [
  navigateTool,
  clickTool,
  fillTool,
  selectTool,
  getTextTool,
  getHtmlTool,
  screenshotTool,
  waitTool,
  executeJsTool,
  goBackTool,
  closeTool,
  getConsoleTool,
  findTool,
  getAttributesTool,
  hoverTool,
  pressKeyTool,
  getNetworkTool,
  getFormFieldsTool,
  uploadFileTool,
  scrollToTool,
  refreshTool,
  getCookiesTool,
  listTabsTool,
  switchTabTool,
  newTabTool,
  dragAndDropTool,
  saveSnapshotTool,
  getSnapshotsTool,
  highlightTool,
  blockRequestsTool,
  setGeoTool,
  askTool,
  setViewportTool,
  setColorSchemeTool,
  setLocaleTool,
  elementScreenshotTool,
  getPerformanceTool,
  exportHarTool,
  exportPdfTool,
  setCookiesTool,
  setLocalStorageTool,
  addPerformanceMarkTool,
  restoreSnapshotTool,
  analyzeSeoTool,
  checkLinksTool,
  checkA11yTool,
  checkSecurityTool,
  visualDiffTool,
  analyzeCssTool,
  networkWaterfallTool,
  testApiTool,
  crawlPagesTool,
  lighthouseAuditTool,
  loadTestTool,
  generateReportTool,
  checkContrastTool,
  analyzeResponsiveTool,
  checkTypographyTool,
  testFormTool,
  testFlowTool,
  smokeTestTool,
  validateHtmlTool,
  fuzzFormTool,
  checkImagesTool,
  checkCacheTool,
  analyzeBundleTool,
  checkThirdPartiesTool,
  perfBudgetTool,
  analyzeDepsTool,
  checkAccessibilityTreeTool,
  validateJsonLdTool,
  checkConsoleErrorsTool,
  analyzeStateTool,
  runSuiteTool,
  ciCheckTool,
  suggestFixesTool,
  explainIssueTool,
  emulateDeviceTool,
  setNetworkTool,
  mockApiTool,
  recordSessionTool,
  checkReadabilityTool,
  checkBrokenAnchorsTool,
  checkSpellingTool,
  checkCookiesConsentTool,
  checkPrivacyFormsTool,
  checkSslTool,
  checkRedirectsTool,
  extractTableTool,
  exportPageDataTool,
  healthCheckTool,
  generatePdfReportTool,
  sendWebhookTool,
  notifySlackTool,
  createJiraIssueTool,
  compareAuditsTool,
  scheduleAuditTool,
  takeNotesTool,
];

const toolMap = new Map(tools.map((t) => [t.name, t]));

function convertToMCPTool(tool: ToolDefinition) {
  const properties: Record<string, unknown> = {};
  for (const [key, zodType] of Object.entries(tool.args)) {
    properties[key] = {
      type: "string",
      description: zodType._def.description || key,
    };
  }
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties,
      required: Object.entries(tool.args)
        .filter(([_, zt]) => !zt.isOptional())
        .map(([key]) => key),
    },
  };
}

const server = new Server(
  { name: "bvp-browser", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(convertToMCPTool),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap.get(name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Ferramenta desconhecida: ${name}` }],
      isError: true,
    };
  }

  // Rate limit check
  const rl = checkRateLimit(name);
  if (!rl.allowed) {
    return {
      content: [{ type: "text", text: `Rate limit exceeded for "${name}". Try again in ${Math.ceil(rl.resetInMs / 1000)}s (limit: ${rl.remaining + 1}/min)` }],
      isError: true,
    };
  }

  const startTime = Date.now();
  let result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean };

  try {
    const parsedArgs: Record<string, unknown> = {};
    for (const [key, zodType] of Object.entries(tool.args)) {
      if (args && key in args) {
        parsedArgs[key] = zodType.parse(args[key]);
      }
    }
    result = await serialized(() => tool.execute(parsedArgs));
  } catch (err) {
    result = {
      content: [{ type: "text", text: `Erro: ${(err as Error).message}` }],
      isError: true,
    };
  }

  // Audit trail
  const duration = Date.now() - startTime;
  const resText = result.content?.[0]?.text || "{}";
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(resText); } catch {}
  writeAudit({
    timestamp: new Date().toISOString(),
    tool: name,
    user: "mcp-client",
    session: "default",
    args: request.params.arguments || {},
    result: {
      status: result.isError ? "fail" : "pass",
      score: parsed.score as number | undefined,
      issueCount: Array.isArray(parsed.issues) ? parsed.issues.length : undefined,
    },
    durationMs: duration,
  });

  // Webhook on error
  if (result.isError) {
    sendWebhook("error", { tool: name, error: resText.slice(0, 200) });
  }

  return result;
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("");
  console.error("╔══════════════════════════════════════════╗");
  console.error("║   🌐 BVP Browser MCP Server Ativo 🌐    ║");
  console.error("║   Navegador visível — Navegue comigo!   ║");
  console.error("╚══════════════════════════════════════════╝");
  console.error("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

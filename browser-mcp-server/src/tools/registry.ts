import { z } from "zod";
import { navigateTool } from "./navigate.js";
import { clickTool } from "./click.js";
import { fillTool } from "./fill.js";
import { selectTool } from "./select.js";
import { getTextTool } from "./getText.js";
import { getHtmlTool } from "./getHtml.js";
import { screenshotTool } from "./screenshot.js";
import { waitTool } from "./wait.js";
import { executeJsTool } from "./executeJs.js";
import { goBackTool } from "./goBack.js";
import { closeTool } from "./close.js";
import { getConsoleTool } from "./getConsole.js";
import { findTool } from "./find.js";
import { getAttributesTool } from "./getAttributes.js";
import { hoverTool } from "./hover.js";
import { pressKeyTool } from "./pressKey.js";
import { getNetworkTool } from "./getNetwork.js";
import { getFormFieldsTool } from "./getFormFields.js";
import { uploadFileTool } from "./uploadFile.js";
import { scrollToTool } from "./scrollTo.js";
import { refreshTool } from "./refresh.js";
import { getCookiesTool } from "./getCookies.js";
import { listTabsTool } from "./listTabs.js";
import { switchTabTool } from "./switchTab.js";
import { newTabTool } from "./newTab.js";
import { dragAndDropTool } from "./dragAndDrop.js";
import { saveSnapshotTool, getSnapshotsTool, restoreSnapshotTool } from "./saveSnapshot.js";
import { highlightTool } from "./highlight.js";
import { blockRequestsTool } from "./blockRequests.js";
import { setGeoTool } from "./setGeo.js";
import { askTool } from "./ask.js";
import { setViewportTool } from "./setViewport.js";
import { setColorSchemeTool } from "./setColorScheme.js";
import { setLocaleTool } from "./setLocale.js";
import { elementScreenshotTool } from "./elementScreenshot.js";
import { getPerformanceTool } from "./getPerformance.js";
import { exportHarTool } from "./exportHar.js";
import { exportPdfTool } from "./exportPdf.js";
import { setCookiesTool } from "./setCookies.js";
import { setLocalStorageTool } from "./setLocalStorage.js";
import { addPerformanceMarkTool } from "./addPerformanceMark.js";
import { analyzeSeoTool } from "./analyzeSeo.js";
import { checkLinksTool } from "./checkLinks.js";
import { checkA11yTool } from "./checkA11y.js";
import { checkSecurityTool } from "./checkSecurity.js";
import { visualDiffTool } from "./visualDiff.js";
import { analyzeCssTool } from "./analyzeCss.js";
import { networkWaterfallTool } from "./networkWaterfall.js";
import { testApiTool } from "./testApi.js";
import { crawlPagesTool } from "./crawlPages.js";
import { lighthouseAuditTool } from "./lighthouseAudit.js";
import { loadTestTool } from "./loadTest.js";
import { generateReportTool } from "./generateReport.js";
import { checkContrastTool } from "./checkContrast.js";
import { analyzeResponsiveTool } from "./analyzeResponsive.js";
import { checkTypographyTool } from "./checkTypography.js";
import { testFormTool } from "./testForm.js";
import { testFlowTool } from "./testFlow.js";
import { smokeTestTool } from "./smokeTest.js";
import { validateHtmlTool } from "./validateHtml.js";
import { fuzzFormTool } from "./fuzzForm.js";
import { checkImagesTool } from "./checkImages.js";
import { checkCacheTool } from "./checkCache.js";
import { analyzeBundleTool } from "./analyzeBundle.js";
import { checkThirdPartiesTool } from "./checkThirdParties.js";
import { perfBudgetTool } from "./perfBudget.js";
import { analyzeDepsTool } from "./analyzeDeps.js";
import { checkAccessibilityTreeTool } from "./checkAccessibilityTree.js";
import { validateJsonLdTool } from "./validateJsonLd.js";
import { checkConsoleErrorsTool } from "./checkConsoleErrors.js";
import { analyzeStateTool } from "./analyzeState.js";
import { runSuiteTool } from "./runSuite.js";
import { ciCheckTool } from "./ciCheck.js";
import { suggestFixesTool } from "./suggestFixes.js";
import { explainIssueTool } from "./explainIssue.js";
import { emulateDeviceTool } from "./emulateDevice.js";
import { setNetworkTool } from "./setNetwork.js";
import { mockApiTool } from "./mockApi.js";
import { recordSessionTool } from "./recordSession.js";
import { checkReadabilityTool } from "./checkReadability.js";
import { checkBrokenAnchorsTool } from "./checkBrokenAnchors.js";
import { checkSpellingTool } from "./checkSpelling.js";
import { checkCookiesConsentTool } from "./checkCookiesConsent.js";
import { checkPrivacyFormsTool } from "./checkPrivacyForms.js";
import { checkSslTool } from "./checkSsl.js";
import { checkRedirectsTool } from "./checkRedirects.js";
import { extractTableTool } from "./extractTable.js";
import { exportPageDataTool } from "./exportPageData.js";
import { healthCheckTool } from "./healthCheck.js";
import { generatePdfReportTool } from "./generatePdfReport.js";
import { sendWebhookTool } from "./sendWebhook.js";
import { notifySlackTool } from "./notifySlack.js";
import { createJiraIssueTool } from "./createJiraIssue.js";
import { compareAuditsTool } from "./compareAudits.js";
import { scheduleAuditTool } from "./scheduleAudit.js";
import { takeNotesTool } from "./takeNotes.js";
import { installExtensionTool } from "./installExtension.js";
import { listExtensionsTool } from "./listExtensions.js";
import { testExtensionTool } from "./testExtension.js";
import { fullSiteAuditTool } from "./fullSiteAudit.js";

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
  installExtensionTool,
  listExtensionsTool,
  testExtensionTool,
  fullSiteAuditTool,
];

const toolMap = new Map(tools.map((t) => [t.name, t]));

function getZodJsonType(zodType: z.ZodType): string {
  let inner: z.ZodType = zodType;
  while ((inner as any)._def?.innerType) {
    inner = (inner as any)._def.innerType;
  }
  const typeName = (inner as any)._def?.typeName;
  if (typeName === "ZodString") return "string";
  if (typeName === "ZodNumber") return "number";
  if (typeName === "ZodBoolean") return "boolean";
  if (typeName === "ZodEnum") return "string";
  if (typeName === "ZodArray") return "array";
  return "string";
}

function convertToMCPTool(tool: ToolDefinition) {
  const properties: Record<string, unknown> = {};
  for (const [key, zodType] of Object.entries(tool.args)) {
    properties[key] = {
      type: getZodJsonType(zodType),
      description: zodType.description || key,
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

function getTool(name: string): ToolDefinition | undefined {
  return toolMap.get(name);
}

export {
  tools,
  toolMap,
  convertToMCPTool,
  getTool,
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
  installExtensionTool,
  listExtensionsTool,
  testExtensionTool,
  fullSiteAuditTool,
};

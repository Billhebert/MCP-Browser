import { chromium, Browser, Page, BrowserContext, ConsoleMessage } from "playwright";
import path from "path";
import os from "os";
import fs from "fs";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

const MAX_CONSOLE_LOGS = 200;
const consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];

const MAX_NETWORK_LOGS = 500;
const networkLogs: Array<{
  method: string;
  url: string;
  status: number;
  statusText: string;
  timestamp: number;
  type: string;
  responseHeaders: Record<string, string>;
  requestHeaders: Record<string, string>;
  bodySize: number;
  transferSize: number;
  isThirdParty: boolean;
  timing: {
    startTime: number;
    domainLookupStart: number;
    domainLookupEnd: number;
    connectStart: number;
    connectEnd: number;
    secureConnectionStart: number;
    requestSent: number;
    responseStart: number;
    responseEnd: number;
  };
}> = [];

const blockedPatterns: string[] = [];
const performanceMarks: Array<{ name: string; time: number; data?: string }> = [];

let lastOperation: Promise<unknown> = Promise.resolve();
let pageLoadTimeout = 30000;

export async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = lastOperation.then(fn, fn);
  lastOperation = result.catch(() => {});
  return result;
}

const PERSISTENT_DIR = path.join(os.homedir(), ".bvp-browser-profile");

function onConsole(msg: ConsoleMessage) {
  const entry = {
    type: msg.type(),
    text: msg.text(),
    timestamp: Date.now(),
  };
  consoleLogs.push(entry);
  if (consoleLogs.length > MAX_CONSOLE_LOGS) consoleLogs.shift();
  if (msg.type() === "error") {
    console.error(`🚨 [Browser console.error] ${msg.text()}`);
  }
}

export function getConsoleLogs() { return [...consoleLogs]; }
export function clearConsoleLogs() { consoleLogs.length = 0; }

export function getNetworkLogs() { return [...networkLogs]; }
export function clearNetworkLogs() { networkLogs.length = 0; }

export function getBlockedPatterns() { return [...blockedPatterns]; }
export function setBlockedPatterns(patterns: string[]) {
  blockedPatterns.length = 0;
  blockedPatterns.push(...patterns);
}

export function getPerformanceMarks() { return [...performanceMarks]; }
export function clearPerformanceMarks() { performanceMarks.length = 0; }
export function addPerformanceMark(name: string, data?: string) {
  performanceMarks.push({ name, time: Date.now(), data });
}

export function setPageLoadTimeout(ms: number) { pageLoadTimeout = ms; }
export function getPageLoadTimeout() { return pageLoadTimeout; }

function onRequest(request: { url: () => string }) {
  const url = request.url();
  for (const pattern of blockedPatterns) {
    if (url.includes(pattern)) return;
  }
}

function onResponse(response: any) {
  const req = response.request();
  let timing: any = {};
  try {
    timing = response.timing() || {};
  } catch {
    timing = {};
  }
  const respHeaders = response.headers();
  const isThirdParty = (() => {
    try {
      const pageUrl = page?.url();
      if (!pageUrl) return false;
      return new URL(response.url()).origin !== new URL(pageUrl).origin;
    } catch { return false; }
  })();

  networkLogs.push({
    method: req.method,
    url: response.url(),
    status: response.status(),
    statusText: response.statusText(),
    timestamp: Date.now(),
    type: req.resourceType,
    responseHeaders: respHeaders,
    requestHeaders: req.headers(),
    bodySize: parseInt(respHeaders["content-length"] || "0", 10) || 0,
    transferSize: parseInt(respHeaders["content-length"] || "0", 10) || 0,
    isThirdParty,
    timing: {
      startTime: timing.startTime,
      domainLookupStart: timing.domainLookupStart,
      domainLookupEnd: timing.domainLookupEnd,
      connectStart: timing.connectStart,
      connectEnd: timing.connectEnd,
      secureConnectionStart: timing.secureConnectionStart,
      requestSent: timing.requestSent,
      responseStart: timing.responseStart,
      responseEnd: timing.responseEnd,
    },
  });
  if (networkLogs.length > MAX_NETWORK_LOGS) networkLogs.shift();
}

async function detectDisplay(): Promise<boolean> {
  if (process.env.DISPLAY) return true;
  if (process.platform === "darwin") return true;
  if (process.platform === "win32") return true;
  return false;
}

async function tryRecover(): Promise<void> {
  try {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  } catch {}
  browser = null;
  context = null;
  page = null;
  console.error(`🔄 Navegador reiniciado automaticamente`);
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    if (browser) await tryRecover();

    const userPref = process.env.BROWSER_HEADLESS;
    const hasDisplay = await detectDisplay();
    const headless = userPref === "true" ? true : userPref === "false" ? false : !hasDisplay;

    if (!fs.existsSync(PERSISTENT_DIR)) {
      fs.mkdirSync(PERSISTENT_DIR, { recursive: true });
    }

    browser = await chromium.launch({
      headless,
      args: ["--start-maximized", "--no-sandbox"],
    });

    const mode = headless ? "headless" : "visível";
    console.error(`🌐 Navegador iniciado (${mode})`);
  }
  return browser;
}

async function getContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  if (!context) {
    const storagePath = path.join(PERSISTENT_DIR, "storage.json");
    context = await b.newContext({
      locale: "pt-BR",
      permissions: ["clipboard-read", "clipboard-write"],
      ...(fs.existsSync(storagePath) ? { storageState: storagePath } : {}),
    });
  }
  return context;
}

export async function setupPageListeners(p: Page): Promise<void> {
  p.on("console", onConsole);
  p.on("pageerror", (err) => {
    console.error(`🚨 [Browser page error] ${err.message}`);
    consoleLogs.push({ type: "pageerror", text: err.message, timestamp: Date.now() });
  });
  p.on("request", onRequest);
  (p as any).on("response", onResponse);
  p.on("crash", () => {
    console.error(`💥 [Browser page crash] A página quebrou!`);
    consoleLogs.push({ type: "pageerror", text: "PAGE_CRASH", timestamp: Date.now() });
  });
}

export async function getPage(): Promise<Page> {
  const ctx = await getContext();
  let needsNew = !page || page.isClosed();
  if (page && !needsNew) {
    try { await page.evaluate("1"); } catch { needsNew = true; }
  }
  if (needsNew) {
    page = await ctx.newPage();
    await setupPageListeners(page);
  }
  return page!;
}

export async function getAllPages(): Promise<Page[]> {
  const ctx = await getContext();
  return ctx.pages();
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    try {
      if (context) {
        const storagePath = path.join(PERSISTENT_DIR, "storage.json");
        await context.storageState({ path: storagePath }).catch(() => {});
        console.error(`💾 Sessão salva em: ${PERSISTENT_DIR}`);
      }
    } catch {}
    try { await browser.close(); } catch {}
    browser = null;
    context = null;
    page = null;
    consoleLogs.length = 0;
    networkLogs.length = 0;
    blockedPatterns.length = 0;
    performanceMarks.length = 0;
    console.error(`🔒 Navegador fechado`);
  }
}

export { getBrowser, getContext };

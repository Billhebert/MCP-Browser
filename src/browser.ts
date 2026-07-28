import { chromium } from "playwright";
let browser: any = null, page: any = null, lastOp: Promise<any> = Promise.resolve();
export async function getPage() {
  if (!page || page.isClosed()) {
    const b = browser || await (async () => { browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] }); return browser; })();
    page = await (await b.newContext()).newPage();
  } return page;
}
export async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const r = lastOp.then(fn, fn); lastOp = r.catch(() => {}); return r;
}
export async function closeBrowser() {
  try { if (page && !page.isClosed()) await page.close(); if (browser && browser.isConnected()) await browser.close(); } catch {}
}

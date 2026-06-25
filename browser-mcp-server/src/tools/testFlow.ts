import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const testFlowTool: ToolDefinition = {
  name: "test_flow",
  description:
    "Executar um fluxo de usuário gravado (teste E2E simples). Recebe um array de steps: { action: 'navigate'|'click'|'fill'|'select'|'wait'|'assert_text'|'assert_url'|'screenshot', selector?, value?, url?, text?, timeout? }. Retorna resultados de cada step.",
  args: {
    steps: z.string().describe("JSON array de steps do fluxo. Ex: [{\"action\":\"navigate\",\"url\":\"https://...\"}, {\"action\":\"click\",\"selector\":\"#btn\"}]"),
    screenshotOnError: z.string().optional().describe("Se 'true', captura screenshot em caso de erro"),
  },
  async execute(args: { steps: string; screenshotOnError?: string }) {
    const page = await getPage();
    const steps: Array<{ action: string; selector?: string; value?: string; url?: string; text?: string; timeout?: string }> = JSON.parse(args.steps);
    const screenshotOnError = args.screenshotOnError === "true";

    const results: Array<{ step: number; action: string; status: string; message: string; screenshot?: string }> = [];

    for (const [i, step] of steps.entries()) {
      const stepNum = i + 1;
      try {
        switch (step.action) {
          case "navigate": {
            if (!step.url) throw new Error("url required for navigate");
            await page.goto(step.url, { waitUntil: "networkidle", timeout: parseInt(step.timeout || "30000") });
            results.push({ step: stepNum, action: "navigate", status: "pass", message: `Navigated to ${step.url}` });
            break;
          }
          case "click": {
            if (!step.selector) throw new Error("selector required for click");
            await page.click(step.selector, { timeout: parseInt(step.timeout || "5000") });
            results.push({ step: stepNum, action: "click", status: "pass", message: `Clicked ${step.selector}` });
            break;
          }
          case "fill": {
            if (!step.selector || step.value === undefined) throw new Error("selector and value required for fill");
            await page.fill(step.selector, step.value);
            results.push({ step: stepNum, action: "fill", status: "pass", message: `Filled ${step.selector} with "${step.value}"` });
            break;
          }
          case "select": {
            if (!step.selector || !step.value) throw new Error("selector and value required for select");
            await page.selectOption(step.selector, step.value);
            results.push({ step: stepNum, action: "select", status: "pass", message: `Selected ${step.value} in ${step.selector}` });
            break;
          }
          case "wait": {
            const ms = parseInt(step.timeout || "2000");
            await page.waitForTimeout(ms);
            results.push({ step: stepNum, action: "wait", status: "pass", message: `Waited ${ms}ms` });
            break;
          }
          case "assert_text": {
            if (!step.text) throw new Error("text required for assert_text");
            const body = await page.evaluate(() => document.body.innerText);
            if (body.includes(step.text)) {
              results.push({ step: stepNum, action: "assert_text", status: "pass", message: `Text found: "${step.text}"` });
            } else {
              throw new Error(`Text not found: "${step.text}"`);
            }
            break;
          }
          case "assert_url": {
            const currentUrl = page.url();
            if (step.url && currentUrl.includes(step.url)) {
              results.push({ step: stepNum, action: "assert_url", status: "pass", message: `URL matches: ${currentUrl}` });
            } else {
              throw new Error(`URL "${currentUrl}" does not match "${step.url}"`);
            }
            break;
          }
          case "screenshot": {
            const buf = await page.screenshot({ type: "png" });
            results.push({ step: stepNum, action: "screenshot", status: "pass", message: "Screenshot captured", screenshot: buf.toString("base64") });
            break;
          }
          default:
            throw new Error(`Unknown action: ${step.action}`);
        }
      } catch (err) {
        const msg = (err as Error).message;
        let screenshot: string | undefined;
        if (screenshotOnError) {
          try { screenshot = (await page.screenshot({ type: "png" })).toString("base64"); } catch {}
        }
        results.push({ step: stepNum, action: step.action, status: "fail", message: msg, screenshot });
      }
    }

    const passCount = results.filter((r) => r.status === "pass").length;
    const failCount = results.filter((r) => r.status === "fail").length;
    console.error(`🔄 Flow: ${passCount} pass, ${failCount} fail (${results.length} steps)`);

    return {
      content: [{ type: "text", text: JSON.stringify({ totalSteps: results.length, passCount, failCount, results }, null, 2) }],
    };
  },
};

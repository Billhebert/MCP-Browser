import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

const DEVICES = [
  { name: "iPhone SE", width: 375, height: 667, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 15 Pro", width: 390, height: 844, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "Pixel 8", width: 412, height: 915, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36" },
  { name: "Samsung Galaxy S24", width: 360, height: 780, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36" },
  { name: "iPad Air", width: 820, height: 1180, userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
  { name: "Desktop 1280", width: 1280, height: 800, userAgent: "" },
  { name: "Desktop 1920", width: 1920, height: 1080, userAgent: "" },
];

export const testMobileSuiteTool: ToolDefinition = {
  name: "test_mobile_suite",
  description: "Testa a página current em múltiplos dispositivos móveis e desktop. Para cada viewport: captura screenshot, mede visibilidade de elements, verifica se há elements escondidos ou overflow. Retorna matriz responsiva com scores.",
  args: {
    customDevices: z.string().max(2000).optional().describe("JSON array custom de devices: [{\"name\":\"...\",\"width\":N,\"height\":N}]"),
    screenshot: z.string().max(10).optional().describe("Capturar screenshots? 'true' ou 'false' (padrão: 'true')"),
  },
  async execute(args: { customDevices?: string; screenshot?: string }) {
    const page = await getPage();
    const url = page.url();
    const captureScreenshot = args.screenshot !== "false";
    const currentContent = await page.content();
    const baseUrl = page.url();

    const devices = args.customDevices ? JSON.parse(args.customDevices) : DEVICES;

    const results: Array<{
      device: string;
      width: number;
      height: number;
      status: string;
      issues: Array<{ type: string; severity: string; message: string }>;
      metrics: Record<string, any>;
      screenshot?: string;
    }> = [];

    for (const device of devices) {
      console.error(`📱 Testando ${device.name} (${device.width}x${device.height})...`);
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.waitForTimeout(300);

      const issues: Array<{ type: string; severity: string; message: string }> = [];

      const data = await page.evaluate(() => {
        const body = document.body;
        if (!body) return { overflowX: false, hiddenElements: 0, totalElements: 0, textNodes: 0, visibleTextNodes: 0 };

        const overflowX = body.scrollWidth > window.innerWidth;
        const allElements = body.querySelectorAll("*");
        let hidden = 0;
        for (const el of Array.from(allElements)) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") hidden++;
        }

        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        let textNodes = 0;
        let visibleTextNodes = 0;
        while (walker.nextNode()) {
          textNodes++;
          const text = walker.currentNode.textContent?.trim();
          if (text) visibleTextNodes++;
        }

        const buttons = document.querySelectorAll("button, a, input, select, textarea");
        let smallTargets = 0;
        for (const el of Array.from(buttons)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
            smallTargets++;
          }
        }

        return {
          overflowX,
          hiddenElements: hidden,
          totalElements: allElements.length,
          textNodes,
          visibleTextNodes,
          smallTargets,
          fontSize: (() => {
            const sizes = new Set<number>();
            for (const el of Array.from(allElements)) {
              const size = parseFloat(window.getComputedStyle(el).fontSize);
              if (!isNaN(size) && size > 0) sizes.add(size);
            }
            return Array.from(sizes).sort((a, b) => a - b);
          })(),
        };
      });

      if (data.overflowX) {
        issues.push({ type: "overflow", severity: "high", message: `Conteúdo extravasa horizontalmente no ${device.name}` });
      }

      const touchTargets = data.smallTargets || 0;
      if (touchTargets > 0) {
        issues.push({ type: "touch-targets", severity: "medium", message: `${touchTargets} element(s) com área de toque < 44px (Mobile)`, });
      }

      const fontSizeMin = data.fontSize?.[0] || 16;
      if (fontSizeMin < 12) {
        issues.push({ type: "font-size", severity: "medium", message: `Font-size mínimo ${fontSizeMin}px abaixo do recomendado 12px`, });
      }

      const entry: any = {
        device: device.name,
        width: device.width,
        height: device.height,
        status: issues.length === 0 ? "pass" : "issues",
        issues,
        metrics: {
          overflowX: data.overflowX,
          hiddenElements: data.hiddenElements,
          totalElements: data.totalElements,
          smallTouchTargets: touchTargets,
          minFontSize: fontSizeMin,
          visibleTextRatio: data.textNodes > 0 ? Math.round((data.visibleTextNodes / data.textNodes) * 100) : 0,
        },
      };

      if (captureScreenshot) {
        const buf = await page.screenshot({ fullPage: false });
        entry.screenshot = buf.toString("base64");
      }

      results.push(entry);
    }

    const passCount = results.filter((r) => r.status === "pass").length;
    const totalScore = Math.round((passCount / results.length) * 100);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            totalScore,
            devicesTested: devices.length,
            passedDevices: passCount,
            averageHiddenElements: Math.round(results.reduce((s, r) => s + r.metrics.hiddenElements, 0) / results.length),
            totalIssues: results.reduce((s, r) => s + r.issues.length, 0),
            results,
            recommendations: results
              .filter((r) => r.issues.length > 0)
              .flatMap((r) => r.issues.map((i) => `[${r.device}] ${i.message}`))
              .slice(0, 20),
          }, null, 2),
        },
      ],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getCDPSession } from "../browser.js";

export const testExtensionTool: ToolDefinition = {
  name: "test_extension",
  description:
    "Testar uma extensão instalada. Abre uma página de teste, dispara a extensão (browser action), captura screenshot do popup e verifica se content scripts foram injetados. Ideal para validar extensões em desenvolvimento.",
  args: {
    extensionId: z.string().max(500).describe("ID da extensão para testar (ex: obtido via list_extensions)"),
    testUrl: z.string().max(5000).optional().describe("URL da página de teste (padrão: about:blank)"),
    action: z.enum(["popup", "content_script", "both"]).optional().describe("O que testar: 'popup' (abre popup), 'content_script' (verifica injeção), 'both' (padrão)"),
    checkConsole: z.boolean().optional().describe("Se true, captura console errors da página de teste"),
  },
  async execute(args: { extensionId: string; testUrl?: string; action?: string; checkConsole?: boolean }) {
    const page = await getPage();
    const cdp = await getCDPSession(page);
    const testUrl = args.testUrl || "about:blank";
    const action = args.action || "both";

    const results: Record<string, any> = {
      extensionId: args.extensionId,
      testUrl,
      action,
      timestamp: new Date().toISOString(),
      popupScreenshot: null,
      contentScriptDetected: false,
      consoleErrors: [],
      errors: [],
    };

    // Navigate to test page
    try {
      await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      results.pageTitle = await page.title().catch(() => testUrl);
    } catch (err) {
      results.errors.push(`Navigation failed: ${(err as Error).message}`);
    }

    // Test popup if requested
    if (action === "popup" || action === "both") {
      try {
        // Get the target ID for the current page
        const targets: any = await cdp.send("Target.getTargets");
        const currentTarget = targets.targetInfos?.find(
          (t: any) => t.url === page.url() || t.attached,
        );

        if (currentTarget) {
          // Wait for a new page (popup) to open
          const popupPromise = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);

          await cdp.send("Extensions.triggerAction", {
            id: args.extensionId,
            targetId: currentTarget.targetId,
          });

          const popup = await popupPromise;
          if (popup) {
            await popup.waitForLoadState("load", { timeout: 5000 }).catch(() => {});
            const popupScreenshot = await popup.screenshot({ type: "png" }).catch(() => null);
            if (popupScreenshot) {
              results.popupScreenshot = popupScreenshot.toString("base64");
              results.popupUrl = popup.url();
              results.popupTitle = await popup.title().catch(() => "");
            }
            await popup.close().catch(() => {});
          } else {
            results.popupScreenshot = null;
            results.errors.push("Popup não abriu dentro do timeout de 5s");
          }
        } else {
          results.errors.push("Não foi possível obter o targetId da página atual");
        }
      } catch (err) {
        results.errors.push(`Popup test failed: ${(err as Error).message}`);
      }
    }

    // Test content script injection
    if (action === "content_script" || action === "both") {
      try {
        const contentScripts = await page.evaluate((extId) => {
          // Check if extension's content script modified the DOM
          const body = document.body;
          if (!body) return { detected: false, reason: "no body" };
          const html = document.documentElement?.outerHTML || "";
          // Look for common content script signatures
          const extAttr = body.getAttribute(`data-${extId}`) ||
            body.getAttribute("data-extension") ||
            body.getAttribute("data-extension-id");
          return {
            detected: !!extAttr,
            attribute: extAttr,
            // Check if any script tags with extension ID exist
            scriptTags: Array.from(document.querySelectorAll(`script[src*="${extId}"], script[data-extension-id="${extId}"]`)).length,
            bodyChildCount: body.children.length,
          };
        }, args.extensionId);
        results.contentScriptDetected = contentScripts.detected || (contentScripts.scriptTags || 0) > 0;
        results.contentScriptInfo = contentScripts;
      } catch (err) {
        results.errors.push(`Content script test failed: ${(err as Error).message}`);
      }
    }

    // Check console if requested
    if (args.checkConsole) {
      const { getConsoleLogs } = await import("../browser.js");
      const logs = getConsoleLogs();
      results.consoleErrors = logs
        .filter((l) => l.type === "error" || l.type === "pageerror")
        .slice(0, 20)
        .map((l) => ({ type: l.type, text: l.text.slice(0, 200) }));
    }

    console.error(`🧪 Extensão ${args.extensionId}: popup=${results.popupScreenshot ? "✅" : "❌"}, contentScript=${results.contentScriptDetected ? "✅" : "❌"}`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2),
      }],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const validateHtmlTool: ToolDefinition = {
  name: "validate_html",
  description:
    "Validar HTML da página atual contra o W3C Markup Validation Service. Envia o HTML para https://validator.w3.org/nu/ e retorna erros, avisos e informações. Limite: ~300KB de HTML.",
  args: {
    parser: z.string().optional().describe("Parser: 'html' (padrão) ou 'xmldoc'"),
  },
  async execute(args: { parser?: string }) {
    const page = await getPage();
    const url = page.url();
    const parser = args.parser || "html";

    const html = await page.evaluate(() => document.documentElement.outerHTML);
    if (html.length > 300000) {
      return {
        content: [{ type: "text", text: JSON.stringify({ url, error: "HTML exceeds 300KB limit for W3C validation" }, null, 2) }],
      };
    }

    const response = await fetch("https://validator.w3.org/nu/?out=json&parser=" + parser, {
      method: "POST",
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    });

    if (!response.ok) {
      return {
        content: [{ type: "text", text: JSON.stringify({ url, error: `W3C API returned ${response.status}` }, null, 2) }],
      };
    }

    const data = (await response.json()) as {
      messages: Array<{
        type: string;
        subtype?: string;
        message: string;
        firstLine?: number;
        lastLine?: number;
        extract?: string;
        hiliteStart?: number;
        hiliteLength?: number;
      }>;
    };

    const errors = data.messages.filter((m) => m.type === "error");
    const warnings = data.messages.filter((m) => m.type === "info" || m.subtype === "warning");

    console.error(`🔍 HTML Validation: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ url, totalErrors: errors.length, totalWarnings: warnings.length, errors: errors.slice(0, 50), warnings: warnings.slice(0, 50) }, null, 2),
      }],
    };
  },
};

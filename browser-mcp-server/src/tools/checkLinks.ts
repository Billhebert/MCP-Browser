import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, getConsoleLogs } from "../browser.js";
import { isSafeUrl } from "../corporate/ssrf.js";

function isLikelyValid(url: string): boolean {
  if (
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("javascript:") ||
    url.startsWith("#") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return false;
  }
  return true;
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export const checkLinksTool: ToolDefinition = {
  name: "check_links",
  description: "Check for broken links. Scans all anchor href attributes, makes HEAD requests.",
  args: {
    checkExternal: z.boolean().optional().describe("Check external links too. Default: false (same domain only)"),
    maxChecks: z.number().int().positive().optional().describe("Maximum links to check. Default: 50"),
    includeConsole: z.boolean().optional().describe("Include console errors/warnings in results. Default: false"),
  },
  async execute(args: { checkExternal?: boolean; maxChecks?: number; includeConsole?: boolean }) {
    const page = await getPage();
    const url = page.url();
    const checkExternal = args.checkExternal === true;
    const maxChecks = args.maxChecks || 50;
    const includeConsole = args.includeConsole === true;

    console.error(`🔗 Check links: ${url}`);

    const links: Array<{ href: string; text: string }> = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: ((a as HTMLAnchorElement).textContent || "").trim().slice(0, 60),
        }))
        .filter((l) => l.href && !l.href.startsWith("javascript:") && !l.href.startsWith("#"));
    });

    console.error(`  Found ${links.length} link(s)`);

    const consoleLogs = getConsoleLogs();
    const consoleErrors = includeConsole
      ? consoleLogs
          .filter((c: any) => c.type === "error" || c.type === "pageerror" || c.type === "warning")
          .map((c: any) => ({ type: c.type, text: c.text }))
      : [];

    const issues: Array<{
      url: string;
      status: number;
      severity: string;
      message: string;
    }> = [];

    let checked = 0;
    for (const link of links) {
      if (checked >= maxChecks) break;
      const absolute = resolveUrl(link.href, url);
      if (!absolute || !isLikelyValid(link.href)) continue;
      if (!checkExternal && !isSameOrigin(absolute, url)) continue;

      checked++;
      try {
        const urlCheck = isSafeUrl(absolute);
        if (!urlCheck.safe) continue; // skip unsafe URLs silently

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(absolute, { method: "HEAD", signal: controller.signal });
        clearTimeout(timer);

        const status = resp.status;
        if (status >= 400) {
          issues.push({
            url: absolute,
            status,
            severity: "error",
            message: `${status} ${resp.statusText} — ${link.text || absolute.slice(0, 80)}`,
          });
        } else if (status >= 300 && status < 400) {
          const location = resp.headers.get("location") || "";
          issues.push({
            url: absolute,
            status,
            severity: "warning",
            message: `Redirect ${status} → ${location.slice(0, 60)} — ${link.text || absolute.slice(0, 60)}`,
          });
        }
      } catch (err: any) {
        issues.push({
          url: absolute,
          status: 0,
          severity: "error",
          message:
            err.name === "AbortError"
              ? `Timeout — ${link.text || absolute.slice(0, 60)}`
              : `Erro: ${err.message?.slice(0, 80)}`,
        });
      }
    }

    const broken = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;

    console.error(`  Checked: ${checked}, Erros: ${broken}, Warnings: ${warnings}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              url,
              total: checked,
              broken,
              warnings,
              issues,
              consoleErrors: consoleErrors.length > 0 ? consoleErrors : undefined,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};

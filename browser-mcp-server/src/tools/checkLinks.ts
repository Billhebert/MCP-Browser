import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getConsoleLogs } from "../browser.js";

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
  description:
    "Verificar links quebrados na página atual. Escaneia todos <a href>, faz requisição HEAD para cada um, e reporta 4xx/5xx/redirects. Opcionalmente verifica links externos e console errors.",
  args: {
    checkExternal: z
      .string()
      .optional()
      .describe("Se 'true', verifica também links externos (padrão: apenas mesmo domínio)"),
    maxChecks: z.string().optional().describe("Número máximo de links para verificar (padrão: 50)"),
    includeConsole: z
      .string()
      .optional()
      .describe("Se 'true', inclui console errors/warnings da página no resultado"),
  },
  async execute(args: { checkExternal?: string; maxChecks?: string; includeConsole?: string }) {
    const page = await getPage();
    const url = page.url();
    const checkExternal = args.checkExternal === "true";
    const maxChecks = parseInt(args.maxChecks || "50", 10);
    const includeConsole = args.includeConsole === "true";

    console.error(`🔗 Check links: ${url}`);

    const links: Array<{ href: string; text: string }> = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: ((a as HTMLAnchorElement).textContent || "").trim().slice(0, 60),
        }))
        .filter((l) => l.href && !l.href.startsWith("javascript:") && !l.href.startsWith("#"));
    });

    console.error(`  Encontrados ${links.length} link(s)`);

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

    console.error(`  Verificados: ${checked}, Erros: ${broken}, Warnings: ${warnings}`);

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

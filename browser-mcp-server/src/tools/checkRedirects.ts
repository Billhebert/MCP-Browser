import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const checkRedirectsTool: ToolDefinition = {
  name: "check_redirects",
  description:
    "Mapear cadeia completa de redirects de uma URL. Segue cada redirect (301, 302, 307, 308) até o destino final e retorna o caminho completo com status codes, tempos de resposta, e recomendações de otimização.",
  args: {
    url: z.string().describe("URL para rastrear redirects"),
    maxRedirects: z.string().optional().describe("Número máximo de redirects a seguir (padrão: 10)"),
  },
  async execute(args: { url: string; maxRedirects?: string }) {
    const page = await getPage();
    const startUrl = args.url;
    const max = parseInt(args.maxRedirects || "10");

    const chain: Array<{ step: number; url: string; status: number; statusText: string; location: string | null; timingMs: number }> = [];
    let currentUrl = startUrl;
    let tooManyRedirects = false;

    for (let i = 0; i < max; i++) {
      const start = Date.now();
      try {
        const response = await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        const elapsed = Date.now() - start;
        const status = response?.status() || 0;
        const statusText = response?.statusText() || "";
        const location = response?.headers()["location"] || null;

        chain.push({ step: i + 1, url: currentUrl, status, statusText, location, timingMs: elapsed });

        if (status < 300 || status >= 400) break;
        if (location) {
          try {
            currentUrl = new URL(location, currentUrl).href;
          } catch {
            currentUrl = location;
          }
        } else {
          break;
        }
      } catch (err) {
        chain.push({ step: i + 1, url: currentUrl, status: 0, statusText: "", location: null, timingMs: Date.now() - start });
        break;
      }
    }

    if (chain.length >= max) tooManyRedirects = true;

    const finalUrl = chain[chain.length - 1]?.url || startUrl;
    const totalTime = chain.reduce((s, c) => s + c.timingMs, 0);
    const redirectCount = chain.length - 1;
    const issues: Array<{ type: string; severity: string; message: string }> = [];

    if (redirectCount > 3) {
      issues.push({ type: "redirect", severity: "high", message: `${redirectCount} redirects na cadeia — excessivo, impacta performance` });
    }
    if (redirectCount > 0 && chain.some((c) => c.status === 302 || c.status === 307)) {
      issues.push({ type: "redirect", severity: "medium", message: "Redirect temporário (302/307) encontrado — prefira 301 para SEO" });
    }
    if (totalTime > 3000) {
      issues.push({ type: "redirect", severity: "low", message: `Cadeia de redirects levou ${totalTime}ms total` });
    }

    const hasRedirectChain = redirectCount > 0;
    console.error(`🔀 Redirects: ${startUrl} → ${finalUrl} (${redirectCount} hops, ${totalTime}ms)`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        startUrl,
        finalUrl,
        redirectCount,
        totalTimeMs: totalTime,
        tooManyRedirects,
        chain,
        issues,
      }, null, 2) }],
    };
  },
};

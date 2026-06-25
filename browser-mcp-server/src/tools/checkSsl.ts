import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const checkSslTool: ToolDefinition = {
  name: "check_ssl",
  description:
    "Verificar certificado SSL/TLS da página atual. Analisa validade, algoritmo, e informações do certificado via response headers e timing de conexão segura. Detecta HTTPS incorreto e problemas de mixed content.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const networkLogs = getNetworkLogs();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    if (!url.startsWith("https://")) {
      issues.push({ type: "ssl", severity: "high", message: "Página não está usando HTTPS", details: "Migre para HTTPS para garantir conexão segura" });
      return {
        content: [{ type: "text", text: JSON.stringify({ url, https: false, issues }, null, 2) }],
      };
    }

    const mainRequest = networkLogs.find((r) => r.url === url);
    const timing = mainRequest?.timing;
    const tlsTime = timing && timing.secureConnectionStart > 0
      ? Math.round((timing.connectEnd - timing.secureConnectionStart) * 1000) / 1000
      : null;

    const certInfo: Record<string, unknown> = {};
    try {
      const security = await page.evaluate(() => {
        const loc = window.location;
        const isSecure = loc.protocol === "https:";
        return { isSecure, hostname: loc.hostname, protocol: loc.protocol };
      });
      certInfo.isSecure = security.isSecure;
      certInfo.hostname = security.hostname;
      certInfo.protocol = security.protocol;
    } catch {}

    const hostname = new URL(url).hostname;

    let certDetails: Record<string, unknown> = {};
    try {
      const resp = await fetch(`https://${hostname}`, { method: "HEAD" });
      certDetails = {
        status: resp.status,
        headers: {
          strictTransportSecurity: resp.headers.get("strict-transport-security"),
          contentSecurityPolicy: resp.headers.get("content-security-policy"),
        },
      };
    } catch (e) {
      issues.push({ type: "ssl", severity: "high", message: `Erro ao verificar certificado SSL: ${(e as Error).message.slice(0, 100)}` });
    }

    if (!certDetails.status) {
      issues.push({ type: "ssl", severity: "high", message: "Não foi possível verificar o certificado SSL" });
    }

    console.error(`🔐 SSL: ${hostname} — ${tlsTime ? `TLS handshake ${tlsTime}ms` : "no timing data"}`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        hostname,
        https: true,
        tlsHandshakeMs: tlsTime,
        certificateCheck: certDetails,
        issues,
      }, null, 2) }],
    };
  },
};

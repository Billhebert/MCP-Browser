import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs } from "../browser.js";

function addIssue(
  issues: Array<{ type: string; severity: string; message: string; details?: string }>,
  type: string,
  severity: string,
  message: string,
  details?: string,
) {
  if (!issues.some((i) => i.message === message)) {
    issues.push({ type, severity, message, details });
  }
}

export const checkSecurityTool: ToolDefinition = {
  name: "check_security",
  description:
    "Auditar segurança da página atual: headers HTTP (CSP, HSTS, XFO, XCTO), cookies (Secure/HttpOnly/SameSite), mixed content, CORS, SRI, OWASP input validation. Retorna score 0-100 com issues detalhadas.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    console.error(`🔒 Security audit: ${url}`);

    const networkLogs = getNetworkLogs();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const present = new Map<string, string>();
    for (const req of networkLogs) {
      if (req.url === url || url.startsWith(req.url)) {
        const h = req.responseHeaders || {};
        if (h["content-security-policy"]) present.set("csp", h["content-security-policy"]);
        if (h["strict-transport-security"]) present.set("hsts", h["strict-transport-security"]);
        if (h["x-frame-options"]) present.set("xfo", h["x-frame-options"]);
        if (h["x-content-type-options"]) present.set("xcto", h["x-content-type-options"]);
        if (h["referrer-policy"]) present.set("referrer-policy", h["referrer-policy"]);
        if (h["permissions-policy"]) present.set("permissions-policy", h["permissions-policy"]);
      }
    }

    if (!present.has("csp"))
      addIssue(issues, "csp", "high", "Missing Content-Security-Policy header");
    if (!present.has("hsts"))
      addIssue(issues, "header", "medium", "Missing Strict-Transport-Security header");
    if (!present.has("xfo"))
      addIssue(issues, "header", "medium", "Missing X-Frame-Options header");
    if (!present.has("xcto"))
      addIssue(issues, "header", "low", "Missing X-Content-Type-Options header");
    if (!present.has("referrer-policy"))
      addIssue(issues, "header", "low", "Missing Referrer-Policy header");
    if (!present.has("permissions-policy"))
      addIssue(issues, "header", "low", "Missing Permissions-Policy header");

    const csp = present.get("csp");
    if (csp) {
      if (/'unsafe-inline'/.test(csp))
        addIssue(issues, "csp", "high", "CSP permite unsafe-inline", "Use nonces ou hashes");
      if (/'unsafe-eval'/.test(csp))
        addIssue(issues, "csp", "high", "CSP permite unsafe-eval");
      if (!/base-uri/.test(csp))
        addIssue(issues, "csp", "medium", "CSP sem base-uri", "Adicione base-uri para prevenir injeção via <base>");
      if (!/object-src/.test(csp))
        addIssue(issues, "csp", "medium", "CSP sem object-src", "Adicione object-src 'none'");
    }

    const seenCookies = new Set<string>();
    for (const req of networkLogs) {
      const setCookie = req.responseHeaders?.["set-cookie"];
      if (!setCookie) continue;
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const raw of cookies) {
        const name = raw.split("=")[0]?.trim();
        if (!name || seenCookies.has(name)) continue;
        seenCookies.add(name);
        const hasSecure = /;\s*secure(\s*;|$)/i.test(raw);
        const hasHttpOnly = /;\s*httponly(\s*;|$)/i.test(raw);
        const hasSameSite = /;\s*samesite=/i.test(raw);
        if (!hasSecure) addIssue(issues, "cookie", "high", `Cookie "${name}" sem Secure flag`);
        if (!hasHttpOnly) addIssue(issues, "cookie", "medium", `Cookie "${name}" sem HttpOnly flag`);
        if (!hasSameSite) addIssue(issues, "cookie", "low", `Cookie "${name}" sem SameSite attribute`);
      }
    }

    if (url.startsWith("https://")) {
      for (const req of networkLogs) {
        if (
          req.url.startsWith("http://") &&
          !req.url.includes("localhost") &&
          !req.url.includes("127.0.0.1")
        ) {
          addIssue(issues, "https", "high", `Mixed content: ${req.url}`);
          break;
        }
      }
    }

    const origin = new URL(url).origin;
    for (const req of networkLogs) {
      if (!req.url || req.url.startsWith(origin)) continue;
      try {
        const acao = req.responseHeaders?.["access-control-allow-origin"];
        if (acao === "*") {
          addIssue(issues, "cors", "medium", `CORS permite todas origens em ${new URL(req.url).hostname}`);
        }
      } catch {}
    }

    const sriData: Array<{ tag: string; src: string }> = await page.evaluate(() => {
      const items: Array<{ tag: string; src: string }> = [];
      const all = Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"][href]'));
      for (const el of all) {
        const src = (el as HTMLLinkElement).href || (el as HTMLScriptElement).src;
        if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
        if (!el.hasAttribute("integrity")) {
          items.push({ tag: el.tagName.toLowerCase(), src });
        }
      }
      return items;
    });

    const pageOrigin = new URL(url).origin;
    const withoutSRI = sriData.filter((r) => !r.src.startsWith(pageOrigin));
    if (withoutSRI.length > 0) {
      addIssue(
        issues,
        "sri",
        "low",
        `${withoutSRI.length} recurso(s) externo(s) sem SRI (${withoutSRI.length} ocorrências)`,
      );
    }

    const owaspIssues: Array<{ type: string; severity: string; message: string; details?: string }> =
      await page.evaluate(() => {
        const items: Array<{ type: string; severity: string; message: string; details?: string }> = [];
        document
          .querySelectorAll(
            'input[type="text"], input[type="search"], input[type="url"], input[type="email"], textarea',
          )
          .forEach((input) => {
            if (!input.getAttribute("maxlength")) {
              const name = input.getAttribute("name") || input.getAttribute("id") || "input";
              items.push({
                type: "owasp",
                severity: "low",
                message: `Input "${name}" sem maxlength`,
                details: "Defina maxlength para prevenir ataques de buffer overflow",
              });
            }
          });
        document.querySelectorAll('input[type="password"]').forEach((pwd) => {
          if (!pwd.hasAttribute("autocomplete")) {
            items.push({
              type: "owasp",
              severity: "low",
              message: "Password input sem autocomplete",
              details: "Adicione autocomplete='current-password' ou 'new-password'",
            });
          }
        });
        return items;
      });

    for (const o of owaspIssues) addIssue(issues, o.type, o.severity, o.message, o.details);

    const severityScores: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3 };
    const catDeductions: Record<string, number> = {};
    for (const issue of issues) {
      const pts = severityScores[issue.severity] ?? 5;
      catDeductions[issue.type] = (catDeductions[issue.type] || 0) + pts;
    }
    let score = 100;
    for (const pts of Object.values(catDeductions)) {
      score -= Math.min(pts, 30);
    }
    score = Math.max(0, Math.min(100, score));

    console.error(`✅ Security: score ${score} (${issues.length} issues)`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { url, score, issues, headersPresent: Object.fromEntries(present) },
            null,
            2,
          ),
        },
      ],
    };
  },
};

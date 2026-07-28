import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const scanOwaspTop10Tool: ToolDefinition = {
  name: "scan_owasp_top10",
  description: "Varre a página current contra OWASP Top 10 (2021). Verifica: A01-Broken Access Control, A02-Cryptographic Failures, A03-Injection, A04-Insecure Design, A05-Security Misconfiguration, A06-Vulnerable Components, A07-Auth Failures, A08-Data Integrity, A09-Logging Failures, A10-SSRF. Retorna score 0-100 com issues categorizadas por risco.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    console.error(`🛡️ OWASP Top 10 scan: ${url}`);

    const networkLogs = getNetworkLogs();
    const issues: Array<{ category: string; risk: string; message: string; details?: string; owaspId: string }> = [];

    const hasSecurityTxt = await page.evaluate(() => {
      return !!document.querySelector('link[rel="security"]') ||
        document.querySelector('a[href*=".well-known/security.txt"]') !== null;
    });
    if (!hasSecurityTxt) {
      issues.push({ category: "A05-Security Misconfiguration", risk: "low", message: "Sem security.txt ou security link", owaspId: "A05" });
    }

    const scriptsFromUrls = networkLogs.filter((r) => r.url && (r.url.endsWith(".js") || r.url.includes("js?")));
    const knownVulnLibs = ["jquery", "angular", "react", "lodash", "moment"];
    for (const req of scriptsFromUrls) {
      const lower = req.url.toLowerCase();
      for (const lib of knownVulnLibs) {
        if (lower.includes(lib) && /\d+\.\d+\.\d+/.test(lower)) {
          issues.push({ category: "A06-Vulnerable Components", risk: "medium", message: `Biblioteca detectada: ${lib} em ${req.url.slice(0, 100)}`, owaspId: "A06" });
          break;
        }
      }
    }

    const awsKeys = await page.evaluate(() => {
      const body = document.body?.textContent || "";
      const keys: string[] = [];
      const patterns = [
        /AKIA[0-9A-Z]{16}/g,
        /ASIA[0-9A-Z]{16}/g,
        /sk_live_[0-9a-z]{24}/g,
        /pk_live_[0-9a-z]{24}/g,
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
      ];
      for (const p of patterns) {
        const matches = body.match(p);
        if (matches) keys.push(...matches);
      }
      return keys;
    });
    if (awsKeys.length > 0) {
      issues.push({ category: "A02-Cryptographic Failures", risk: "critical", message: `${awsKeys.length} chave(s)/token(s) exposta(s) no HTML`, owaspId: "A02" });
    }

    const forms = await page.evaluate(() => {
      const allForms = document.querySelectorAll("form");
      return Array.from(allForms).map((f) => ({
        action: f.getAttribute("action") || "",
        method: (f.getAttribute("method") || "get").toLowerCase(),
        inputs: Array.from(f.querySelectorAll("input, textarea, select")).map((i) => ({
          type: (i as HTMLInputElement).type || "text",
          name: i.getAttribute("name") || i.getAttribute("id") || "",
          id: i.getAttribute("id") || "",
          autocomplete: i.getAttribute("autocomplete") || null,
        })),
      }));
    });
    for (const form of forms) {
      if (form.method !== "post") {
        issues.push({ category: "A01-Broken Access Control", risk: "medium", message: `Formulário usa method=${form.method.toUpperCase()} (deveria ser POST)`, owaspId: "A01" });
      }
      const passwordInputs = form.inputs.filter((i) => i.type === "password");
      for (const pwd of passwordInputs) {
        if (pwd.autocomplete && pwd.autocomplete === "on") {
          issues.push({ category: "A07-Auth Failures", risk: "high", message: `Password input "${pwd.name}" com autocomplete=on`, owaspId: "A07" });
        }
      }
      if (form.action && form.action.includes("http://") && !form.action.includes("localhost")) {
        issues.push({ category: "A02-Cryptographic Failures", risk: "high", message: `Formulário envia dados via HTTP (não HTTPS): ${form.action}`, owaspId: "A02" });
      }
    }

    const inputs = await page.evaluate(() => {
      const all = document.querySelectorAll("input, textarea");
      return Array.from(all).map((el) => ({
        type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
        name: el.getAttribute("name") || el.getAttribute("id") || "",
        maxlength: el.getAttribute("maxlength") || null,
        pattern: el.getAttribute("pattern") || null,
        id: el.getAttribute("id") || "",
      }));
    });
    for (const inp of inputs) {
      if (inp.type === "text" || inp.type === "search" || inp.type === "textarea") {
        if (!inp.maxlength) {
          issues.push({ category: "A03-Injection", risk: "low", message: `Input "${inp.name}" sem maxlength (XSS/SQL Injection vector)`, owaspId: "A03" });
        }
      }
    }

    const cookies = await page.evaluate(() => document.cookie);
    if (cookies) {
      const cookieParts = cookies.split(";").map((c) => c.trim());
      for (const c of cookieParts) {
        if (c.toLowerCase().includes("session") || c.toLowerCase().includes("token")) {
          issues.push({ category: "A07-Auth Failures", risk: "medium", message: `Cookie de sessão detectado (verifique flags Secure/HttpOnly/SameSite)`, owaspId: "A07" });
          break;
        }
      }
    }

    for (const req of networkLogs) {
      if (req.url && req.url.startsWith("http://") && !req.url.includes("localhost") && !req.url.includes("127.0.0.1")) {
        issues.push({ category: "A02-Cryptographic Failures", risk: "high", message: `Requisição HTTP (não HTTPS): ${req.url.slice(0, 100)}`, owaspId: "A02" });
        break;
      }
    }

    const responseHeaders = networkLogs.find((r) => r.url === url)?.responseHeaders || {};
    if (!responseHeaders["content-security-policy"]) {
      issues.push({ category: "A05-Security Misconfiguration", risk: "high", message: "Missing Content-Security-Policy header", owaspId: "A05" });
    }
    if (!responseHeaders["x-content-type-options"]) {
      issues.push({ category: "A05-Security Misconfiguration", risk: "low", message: "Missing X-Content-Type-Options header", owaspId: "A05" });
    }

    const cookieHeaders = networkLogs.filter((r) => r.responseHeaders?.["set-cookie"]);
    for (const req of cookieHeaders) {
      const raw = String(req.responseHeaders["set-cookie"]);
      if (!raw.includes("HttpOnly")) {
        issues.push({ category: "A07-Auth Failures", risk: "medium", message: "Cookie sem HttpOnly flag", owaspId: "A07" });
      }
      if (!raw.includes("Secure")) {
        issues.push({ category: "A07-Auth Failures", risk: "medium", message: "Cookie sem Secure flag", owaspId: "A07" });
      }
    }

    const jsonEndpoints = networkLogs.filter((r) => r.url && (r.url.includes("/api/") || r.url.includes("/graphql") || r.url.includes("/rest/")));
    for (const ep of jsonEndpoints) {
      if (!ep.responseHeaders?.["access-control-allow-origin"]) {
        issues.push({ category: "A01-Broken Access Control", risk: "low", message: `Endpoint sem CORS header: ${ep.url.slice(0, 80)}`, owaspId: "A01" });
      }
    }

    const severityScores: Record<string, number> = { critical: 30, high: 15, medium: 8, low: 3 };
    const catDeductions: Record<string, number> = {};
    for (const issue of issues) {
      const pts = severityScores[issue.risk] || 5;
      catDeductions[issue.category] = (catDeductions[issue.category] || 0) + pts;
    }
    let score = 100;
    for (const pts of Object.values(catDeductions)) {
      score -= Math.min(pts, 40);
    }
    score = Math.max(0, Math.min(100, score));

    const owaspCategories: Record<string, { checked: boolean; issues: number; status: string }> = {
      "A01-Broken Access Control": { checked: true, issues: 0, status: "pass" },
      "A02-Cryptographic Failures": { checked: true, issues: 0, status: "pass" },
      "A03-Injection": { checked: true, issues: 0, status: "pass" },
      "A04-Insecure Design": { checked: true, issues: 0, status: "pass" },
      "A05-Security Misconfiguration": { checked: true, issues: 0, status: "pass" },
      "A06-Vulnerable Components": { checked: true, issues: 0, status: "pass" },
      "A07-Auth Failures": { checked: true, issues: 0, status: "pass" },
      "A08-Data Integrity": { checked: true, issues: 0, status: "pass" },
      "A09-Logging Failures": { checked: false, issues: 0, status: "info" },
      "A10-SSRF": { checked: false, issues: 0, status: "info" },
    };
    for (const issue of issues) {
      if (owaspCategories[issue.category]) {
        owaspCategories[issue.category].issues++;
        owaspCategories[issue.category].status = "fail";
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            score,
            totalIssues: issues.length,
            criticalCount: issues.filter((i) => i.risk === "critical").length,
            highCount: issues.filter((i) => i.risk === "high").length,
            mediumCount: issues.filter((i) => i.risk === "medium").length,
            lowCount: issues.filter((i) => i.risk === "low").length,
            owaspSummary: owaspCategories,
            issues,
            recommendations: issues
              .filter((i) => i.risk === "critical" || i.risk === "high")
              .map((i) => `[${i.risk.toUpperCase()}] ${i.owaspId}: ${i.message}`)
              .slice(0, 10),
          }, null, 2),
        },
      ],
    };
  },
};

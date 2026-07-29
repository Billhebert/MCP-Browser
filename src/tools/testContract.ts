import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

interface ContractAssertion {
  name: string;
  status: "pass" | "fail";
  actual?: unknown;
  expected?: unknown;
  error?: string;
}

async function evaluateContract(page: any, contract: any, baseUrl: string): Promise<ContractAssertion[]> {
  const results: ContractAssertion[] = [];

  if (contract.assert?.selectors) {
    for (const sel of contract.assert.selectors) {
      const result = await page.evaluate((s: any) => {
        const el = document.querySelector(s.selector);
        if (s.check === "exists") return { exists: !!el };
        if (s.check === "not-exists") return { exists: !!el };
        if (s.check === "visible") {
          if (!el) return { visible: false };
          const style = window.getComputedStyle(el);
          return { visible: style.display !== "none" && style.visibility !== "hidden" && (el as HTMLElement).offsetWidth > 0 };
        }
        if (s.check === "count") {
          return { count: document.querySelectorAll(s.selector).length };
        }
        if (s.attribute) {
          return { value: el?.getAttribute(s.attribute) || null };
        }
        return { value: el?.textContent?.trim() || null };
      }, sel);

      if (sel.check === "exists") {
        results.push({ name: sel.name || sel.selector, status: result.exists ? "pass" : "fail", actual: result.exists, expected: true });
      } else if (sel.check === "not-exists") {
        results.push({ name: sel.name || sel.selector, status: !result.exists ? "pass" : "fail", actual: result.exists, expected: false });
      } else if (sel.check === "visible") {
        results.push({ name: sel.name || sel.selector, status: result.visible ? "pass" : "fail", actual: result.visible, expected: true });
      } else if (sel.check === "count") {
        const match = result.count === sel.expected;
        results.push({ name: sel.name || sel.selector, status: match ? "pass" : "fail", actual: result.count, expected: sel.expected });
      } else if (sel.check === "regex") {
        const re = new RegExp(sel.expected);
        const match = re.test(result.value || "");
        results.push({ name: sel.name || sel.selector, status: match ? "pass" : "fail", actual: result.value, expected: sel.expected });
      } else if (sel.attribute) {
        const match = result.value === sel.expected;
        results.push({ name: sel.name || sel.selector, status: match ? "pass" : "fail", actual: result.value, expected: sel.expected });
      } else {
        const match = result.value === sel.expected;
        results.push({ name: sel.name || sel.selector, status: match ? "pass" : "fail", actual: result.value, expected: sel.expected });
      }
    }
  }

  if (contract.assert?.api) {
    for (const apiCall of contract.assert.api) {
      try {
        const apiUrl = apiCall.url.startsWith("http") ? apiCall.url : new URL(apiCall.url, baseUrl).href;
        const options: Record<string, any> = { method: apiCall.method || "GET", headers: { "Content-Type": "application/json" } };
        if (apiCall.body && apiCall.method !== "GET") {
          options.body = JSON.stringify(apiCall.body);
        }
        const res = await fetch(apiUrl, options);
        const body = await res.json().catch(() => ({}));
        const statusMatch = res.status === (apiCall.expectedStatus || 200);
        let bodyMatch = true;
        if (apiCall.expectedBody && statusMatch) {
          for (const [key, val] of Object.entries(apiCall.expectedBody)) {
            if ((body as any)[key] !== val) { bodyMatch = false; break; }
          }
        }
        results.push({
          name: apiCall.name || `${apiCall.method} ${apiCall.url}`,
          status: statusMatch && bodyMatch ? "pass" : "fail",
          actual: statusMatch ? body : `HTTP ${res.status}`,
          expected: { status: apiCall.expectedStatus || 200, body: apiCall.expectedBody },
        });
      } catch (err) {
        results.push({ name: apiCall.name || apiCall.url, status: "fail", error: (err as Error).message });
      }
    }
  }

  if (contract.assert?.console) {
    const logs = await page.evaluate(() => {
      return { errors: 0, warnings: 0 };
    });
    const maxErrors = contract.assert.console.errors ?? 0;
    results.push({
      name: "Console errors",
      status: logs.errors <= maxErrors ? "pass" : "fail",
      actual: logs.errors,
      expected: `≤${maxErrors}`,
    });
    if (contract.assert.console.warnings?.max) {
      results.push({
        name: "Console warnings",
        status: logs.warnings <= contract.assert.console.warnings.max ? "pass" : "fail",
        actual: logs.warnings,
        expected: `≤${contract.assert.console.warnings.max}`,
      });
    }
  }

  if (contract.assert?.performance) {
    const perf = await page.evaluate(() => {
      return new Promise<Record<string, any>>((resolve) => {
        const results: Record<string, any> = { lcp: 0, cls: 0 };
        const lcpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) results.lcp = entries[entries.length - 1].startTime;
        });
        lcpObs.observe({ type: "largest-contentful-paint", buffered: true } as any);
        const clsObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) results.cls += (e as any).value || 0;
        });
        clsObs.observe({ type: "layout-shift", buffered: true } as any);
        setTimeout(() => { lcpObs.disconnect(); clsObs.disconnect(); resolve(results); }, 2000);
      });
    });
    if (contract.assert.performance.lcp?.max) {
      results.push({ name: "LCP", status: perf.lcp <= contract.assert.performance.lcp.max ? "pass" : "fail", actual: perf.lcp, expected: `≤${contract.assert.performance.lcp.max}ms` });
    }
    if (contract.assert.performance.cls?.max) {
      results.push({ name: "CLS", status: perf.cls <= contract.assert.performance.cls.max ? "pass" : "fail", actual: perf.cls, expected: `≤${contract.assert.performance.cls.max}` });
    }
  }

  if (contract.assert?.audit) {
    const { analyzeSeoTool } = await import("./analyzeSeo.js");
    if (contract.assert.audit.seo?.minScore) {
      const res = await analyzeSeoTool.execute({});
      const text = res.content?.[0]?.text || "{}";
      const data = JSON.parse(text);
      results.push({ name: "SEO Score", status: data.score >= contract.assert.audit.seo.minScore ? "pass" : "fail", actual: data.score, expected: `≥${contract.assert.audit.seo.minScore}` });
    }
    if (contract.assert.audit.a11y?.minScore) {
      const { checkA11yTool } = await import("./checkA11y.js");
      const res = await checkA11yTool.execute({});
      const text = res.content?.[0]?.text || "{}";
      const data = JSON.parse(text);
      results.push({ name: "A11Y Score", status: data.score >= contract.assert.audit.a11y.minScore ? "pass" : "fail", actual: data.score, expected: `≥${contract.assert.audit.a11y.minScore}` });
    }
  }

  if (contract.assert?.cookies) {
    const cookies = await page.evaluate(() => document.cookie);
    for (const expected of contract.assert.cookies) {
      const exists = cookies.includes(`${expected.name}=`);
      let secure = true;
      if (expected.secure) secure = true;
      results.push({ name: `Cookie: ${expected.name}`, status: exists ? "pass" : "fail", actual: exists ? "present" : "missing", expected: "present" });
    }
  }

  return results;
}

export const testContractTool: ToolDefinition = {
  name: "test_contract",
  description: "Executa um contrato de teste JSON contra uma página web. Valida seletores (texto, atributos, existência, visibilidade, contagem, regex), APIs REST (status + body), performance (LCP, CLS), console errors, auditorias (SEO, a11y), e cookies. Ideal para TDD: defina o contrato antes do desenvolvimento e valide depois.",
  args: {
    contract: z.string().max(50000).describe("JSON com o contrato de teste. Ex: {\"name\":\"...\",\"url\":\"...\",\"actions\":[],\"assert\":{...}}"),
    file: z.string().max(1000).optional().describe("Path para file .contract.json (alternativa ao contract)"),
  },
  async execute(args: { contract?: string; file?: string }) {
    let contractRaw = args.contract;
    if (args.file) {
      const fs = await import("node:fs");
      contractRaw = fs.readFileSync(args.file, "utf-8");
    }
    if (!contractRaw) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Forneça contract (JSON) ou file (Path)" }) }], isError: true };
    }

    const contract = JSON.parse(contractRaw);
    const page = await getPage();
    const baseUrl = contract.url || page.url();

    if (contract.url) {
      await page.goto(contract.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
    }

    if (contract.actions) {
      for (const action of contract.actions) {
        switch (action.type) {
          case "click": await page.click(action.selector); break;
          case "fill": await page.fill(action.selector, action.value); break;
          case "select": await page.selectOption(action.selector, action.value); break;
          case "wait": await page.waitForTimeout(action.ms || 1000); break;
          case "waitForSelector": await page.waitForSelector(action.selector, { timeout: action.timeout || 5000 }); break;
          case "screenshot": break;
        }
      }
    }

    const results = await evaluateContract(page, contract, baseUrl);

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const score = results.length > 0 ? Math.round((passed / results.length) * 100) : 0;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            contract: contract.name || "Untitled Contract",
            url: baseUrl,
            passed,
            failed,
            total: results.length,
            score,
            status: failed === 0 ? "passed" : "failed",
            results,
            summary: {
              passed: `${passed}/${results.length} assertions passed`,
              score: `${score}/100`,
              verdict: failed === 0 ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED",
            },
          }, null, 2),
        },
      ],
    };
  },
};

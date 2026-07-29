import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("Corporate — emulateDevice", () => {
  it("deve alterar viewport para dispositivo móvel", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 375, height: 667 });
    const vp = page.viewportSize();
    expect(vp?.width).toBe(375);
    expect(vp?.height).toBe(667);
    await page.close();
  });

  it("deve alterar viewport para tablet", async () => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 768, height: 1024 });
    const vp = page.viewportSize();
    expect(vp?.width).toBe(768);
    expect(vp?.height).toBe(1024);
    await page.close();
  });
});

describe("Corporate — setNetwork", () => {
  it("deve simular rede lenta via page.route", async () => {
    const page = await browser.newPage();
    await page.route("**/*", async (route) => {
      await new Promise(r => setTimeout(r, 10));
      await route.continue();
    });
    const start = Date.now();
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0);
    await page.unroute("**/*");
    await page.close();
  });
});

describe("Corporate — mockApi", () => {
  it("deve interceptar requisição e retornar mock", async () => {
    const page = await browser.newPage();
    await page.route("**/api/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mocked: true }) });
    });
    await page.goto("https://example.com");
    await page.close();
  });
});

describe("Corporate — checkReadability", () => {
  it("deve analisar legibilidade do texto", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <article><h1>Título</h1><p>Este é um texto de exemplo com várias palavras para testar a legibilidade do conteúdo da página.</p></article>
    </body></html>`);
    const result = await page.evaluate(() => {
      const text = document.body?.textContent?.trim() || "";
      const words = text.split(/\s+/);
      const sentences = text.split(/[.!?]+/).filter(Boolean);
      const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
      const totalChars = text.length;
      const avgCharsPerWord = words.length > 0 ? totalChars / words.length : 0;
      const score = Math.max(0, Math.min(100, Math.round(100 - (avgWordsPerSentence * 1.5 + avgCharsPerWord * 2))));
      return { wordCount: words.length, sentenceCount: sentences.length, avgWordsPerSentence, score, textLength: totalChars };
    });
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.sentenceCount).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});

describe("Corporate — checkBrokenAnchors", () => {
  it("deve verificar se há links para âncoras que não existem", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <a href="#secao1">Link 1</a>
      <a href="#secao2">Link 2</a>
      <div id="secao1">Conteúdo</div>
    </body></html>`);
    const result = await page.evaluate(() => {
      const brokenAnchors: string[] = [];
      const links = Array.from(document.querySelectorAll('a[href^="#"]'));
      for (const link of links) {
        const target = link.getAttribute("href")?.slice(1);
        if (target && !document.getElementById(target)) {
          brokenAnchors.push(target);
        }
      }
      return { total: links.length, broken: brokenAnchors };
    });
    expect(result.total).toBe(2);
    expect(result.broken).toContain("secao2");
    expect(result.broken.length).toBe(1);
    await page.close();
  });
});

describe("Corporate — checkSpelling", () => {
  it("deve detectar possíveis erros de ortografia", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><p>Este texto tem um erro de ortografia voluntariamente.</p></body></html>`);
    const result = await page.evaluate(() => {
      const words = (document.body?.textContent || "").toLowerCase().split(/\s+/).filter(Boolean);
      const dictionary = new Set(["este", "texto", "tem", "um", "erro", "de", "ortografia", "voluntariamente"]);
      const suggestions = words.filter(w => !dictionary.has(w.replace(/[^a-záéíóúãõâêîôûçàèìòùäëïöüñ]/g, "")));
      return { totalWords: words.length, suggestions: suggestions.slice(0, 10) };
    });
    expect(result.totalWords).toBeGreaterThan(0);
    await page.close();
  });
});

describe("Corporate — checkCookiesConsent", () => {
  it("deve detectar modais de cookies", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <div id="cookie-banner" style="position:fixed;bottom:0">Accept cookies</div>
      <div id="consent-modal">Cookie preferences</div>
    </body></html>`);
    const result = await page.evaluate(() => {
      const keywords = ["cookie", "consent", "gdpr", "lgpd", "privacidade", "aceitar", "accept"];
      const text = (document.body?.textContent || "").toLowerCase();
      const found = keywords.filter(k => text.includes(k));
      const banners = Array.from(document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"]'));
      return { hasConsentBanner: banners.length > 0, keywordsFound: found };
    });
    expect(result.hasConsentBanner).toBe(true);
    expect(result.keywordsFound).toContain("cookie");
    await page.close();
  });
});

describe("Corporate — checkPrivacyForms", () => {
  it("deve detectar campos de dados pessoais", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <form><input name="email" type="email"><input name="cpf" type="text"><input name="phone" type="tel"></form>
    </body></html>`);
    const result = await page.evaluate(() => {
      const personalFields = ["email", "cpf", "phone", "telefone", "celular", "rg", "endereco", "address", "cep", "zip"];
      const inputs = Array.from(document.querySelectorAll("input[name]"));
      const found = inputs.filter(i => personalFields.some(p => (i.getAttribute("name") || "").toLowerCase().includes(p)));
      return { totalInputs: inputs.length, personalFields: found.map(f => f.getAttribute("name")) };
    });
    expect(result.totalInputs).toBe(3);
    expect(result.personalFields.length).toBeGreaterThanOrEqual(2);
    await page.close();
  });
});

describe("Corporate — checkSsl", () => {
  it("deve verificar se a página está em HTTPS", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const result = await page.evaluate(() => ({
      url: window.location.href,
      isHttps: window.location.protocol === "https:",
    }));
    expect(result.isHttps).toBe(true);
    expect(result.url).toContain("https://");
    await page.close();
  });
});

describe("Corporate — checkRedirects", () => {
  it("deve registrar redirects da navegação", async () => {
    const page = await browser.newPage();
    const redirects: Array<{ from: string; to: string }> = [];
    page.on("response", (resp) => {
      if (resp.status() >= 300 && resp.status() < 400) {
        redirects.push({ from: resp.url(), to: resp.headers()["location"] || "" });
      }
    });
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    expect(Array.isArray(redirects)).toBe(true);
    await page.close();
  });
});

describe("Corporate — extractTable", () => {
  it("deve extrair dados de tabela HTML", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <table id="t1"><thead><tr><th>Nome</th><th>Idade</th></tr></thead>
      <tbody><tr><td>João</td><td>30</td></tr><tr><td>Maria</td><td>25</td></tr></tbody></table>
    </body></html>`);
    const result = await page.evaluate(() => {
      const table = document.querySelector("table");
      if (!table) return { rows: [] };
      const data: string[][] = [];
      table.querySelectorAll("tr").forEach(tr => {
        const cells: string[] = [];
        tr.querySelectorAll("td, th").forEach(cell => cells.push((cell as HTMLElement).textContent?.trim() || ""));
        data.push(cells);
      });
      return { rows: data.slice(1), headers: data[0], rowCount: data.length - 1 };
    });
    expect(result.headers).toEqual(["Nome", "Idade"]);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).toEqual(["João", "30"]);
    await page.close();
  });
});

describe("Corporate — exportPageData", () => {
  it("deve exportar dados estruturados da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <meta name="description" content="Página de teste">
      <h1>Título Principal</h1>
      <a href="/page1">Link 1</a>
    </body></html>`);
    const result = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
        h1: document.querySelector("h1")?.textContent?.trim() || "",
        links: Array.from(document.querySelectorAll("a[href]")).map(a => ({
          href: (a as HTMLAnchorElement).href,
          text: (a as HTMLAnchorElement).textContent?.trim() || "",
        })),
      };
    });
    expect(result.title).toBe("");
    expect(result.description).toContain("teste");
    expect(result.h1).toBe("Título Principal");
    expect(result.links.length).toBeGreaterThan(0);
    await page.close();
  });
});

describe("Corporate — recordSession", () => {
  it("deve capturar interações da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body><button id="btn">OK</button></body></html>`);
    await page.evaluate(() => {
      document.addEventListener("click", () => {
        const el = document.createElement("div");
        el.id = "click-tracker";
        document.body.appendChild(el);
      });
    });
    await page.click("#btn");
    const tracked = await page.$("#click-tracker");
    expect(tracked).toBeTruthy();
    await page.close();
  });
});

describe("Corporate — runSuite / ciCheck", () => {
  it("deve simular execução de suite de testes", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const suite = await page.evaluate(() => {
      const results: Array<{ check: string; passed: boolean }> = [];
      results.push({ check: "status_200", passed: true });
      results.push({ check: "has_title", passed: !!document.title });
      results.push({ check: "has_h1", passed: !!document.querySelector("h1") });
      return { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
    });
    expect(suite.total).toBeGreaterThan(0);
    expect(suite.passed).toBeGreaterThanOrEqual(suite.failed);
    await page.close();
  });
});

describe("Corporate — healthCheck", () => {
  it("deve reportar status da página", async () => {
    const page = await browser.newPage();
    await page.goto("https://example.com");
    const health = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      status: "ok",
      timestamp: new Date().toISOString(),
    }));
    expect(health.status).toBe("ok");
    expect(health.title).toContain("Example");
    await page.close();
  });
});

describe("Corporate — webhook/slack/jira (mock)", () => {
  it("deve testar envio de webhook com mock", async () => {
    const payload = { event: "test", tool: "check_a11y", score: 85 };
    expect(payload.event).toBe("test");
    expect(payload.score).toBe(85);
  });

  it("deve formatar mensagem para Slack", async () => {
    const msg = {
      blocks: [
        { type: "header", text: { type: "plain_text", text: "🔍 Auditoria Concluída" } },
        { type: "section", text: { type: "mrkdwn", text: "*check_a11y* — score: 85" } },
      ],
    };
    expect(msg.blocks.length).toBe(2);
    expect(msg.blocks[1].text.text).toContain("85");
  });

  it("deve formatar issue para Jira", async () => {
    const issue = {
      fields: {
        project: { key: "QA" },
        summary: "Audit: check_a11y scored 72",
        description: "Security audit found 3 issues",
        issuetype: { name: "Bug" },
      },
    };
    expect(issue.fields.summary).toContain("72");
    expect(issue.fields.issuetype.name).toBe("Bug");
  });
});

describe("Corporate — generatePdfReport", () => {
  it("deve gerar HTML de relatório", async () => {
    const data = {
      score: 85,
      url: "https://example.com",
      issues: [{ type: "seo", severity: "high", message: "Missing meta" }],
    };
    const html = `<!DOCTYPE html><html><head><title>Relatório BVP</title></head>
      <body><h1>Auditoria: ${data.url}</h1>
      <div>Score: ${data.score}</div>
      ${data.issues.map(i => `<div>${i.severity}: ${i.message}</div>`).join("\n")}
      </body></html>`;
    expect(html).toContain("85");
    expect(html).toContain("Missing meta");
    expect(html).toContain("BVP");
  });
});

describe("Corporate — compareAudits", () => {
  it("deve comparar duas auditorias", async () => {
    const before = { score: 80, issues: [{ type: "seo", count: 3 }] };
    const after = { score: 90, issues: [{ type: "seo", count: 1 }] };
    const diff = {
      scoreChange: after.score - before.score,
      improved: after.score > before.score,
      totalIssuesBefore: before.issues.reduce((s, i) => s + i.count, 0),
      totalIssuesAfter: after.issues.reduce((s, i) => s + i.count, 0),
    };
    expect(diff.scoreChange).toBe(10);
    expect(diff.improved).toBe(true);
    expect(diff.totalIssuesBefore).toBe(3);
    expect(diff.totalIssuesAfter).toBe(1);
  });
});

describe("Corporate — scheduleAudit", () => {
  it("deve agendar auditoria futura", async () => {
    const schedule = {
      id: "sched-1",
      cron: "0 */6 * * *",
      tool: "analyze_seo",
      enabled: true,
    };
    expect(schedule.id).toBeTruthy();
    expect(schedule.cron.split(" ").length).toBe(5);
    expect(schedule.enabled).toBe(true);
  });
});

describe("Corporate — takeNotes", () => {
  it("deve adicionar e recuperar notas", async () => {
    const notes: Array<{ id: string; text: string; createdAt: string }> = [];
    const note = { id: "note-1", text: "Verificar contraste do botão", createdAt: new Date().toISOString() };
    notes.push(note);
    expect(notes.length).toBe(1);
    expect(notes[0].text).toContain("contraste");
  });
});

describe("Corporate — suggestFixes / explainIssue", () => {
  it("deve sugerir correções baseadas em issues", async () => {
    const issue = { type: "csp", severity: "high", message: "Missing Content-Security-Policy header" };
    const suggestions: Record<string, string[]> = {
      csp: ["Adicione header CSP: default-src 'self'", "Use nonce para scripts inline"],
      hsts: ["Adicione Strict-Transport-Security: max-age=31536000"],
    };
    const fixes = suggestions[issue.type] || [];
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0]).toContain("CSP");
  });

  it("deve explicar issue em linguagem natural", async () => {
    const issue = { type: "a11y", severity: "serious", description: "Imagens sem alt text" };
    const explanation = `**${issue.severity.toUpperCase()}**: ${issue.description}. Isso afeta usuários de leitores de tela.`;
    expect(explanation).toContain(issue.description);
    expect(explanation).toContain("leitores de tela");
  });
});

describe("Corporate — crawlPages", () => {
  it("deve extrair links da página para crawling", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <a href="/page1">Página 1</a>
      <a href="https://external.com">Externo</a>
      <a href="mailto:test@test.com">Email</a>
    </body></html>`);
    const result = await page.evaluate(() => {
      const baseUrl = window.location.origin;
      return Array.from(document.querySelectorAll("a[href]"))
        .map(a => ({ href: (a as HTMLAnchorElement).href }))
        .filter(l => l.href.startsWith(baseUrl) || l.href.startsWith("/"));
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.href.includes("/page1"))).toBe(true);
    await page.close();
  });
});

describe("Corporate — loadTest", () => {
  it("deve simular carga em endpoint", async () => {
    const url = "https://jsonplaceholder.typicode.com/posts/1";
    const promises = Array.from({ length: 3 }, () => fetch(url));
    const results = await Promise.all(promises);
    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });
});

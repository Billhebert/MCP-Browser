import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe("Data — export_csv", () => {
  it("deve extrair dados de tabela HTML", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <table>
        <tr><th>Nome</th><th>Idade</th></tr>
        <tr><td>João</td><td>30</td></tr>
        <tr><td>Maria</td><td>25</td></tr>
      </table>
    </body></html>`);
    const result = await page.evaluate(() => {
      const table = document.querySelector("table");
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll("tr"));
      return rows.map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((c) => c.textContent?.trim() || "")
      );
    });
    expect(result).toBeDefined();
    expect(result!.length).toBe(3);
    expect(result![0]).toEqual(["Nome", "Idade"]);
    expect(result![1]).toEqual(["João", "30"]);
    expect(result![2]).toEqual(["Maria", "25"]);
    await page.close();
  });

  it("deve extrair links da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <a href="https://example.com">Example</a>
      <a href="/about">About</a>
    </body></html>`);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        text: (a.textContent || "").trim(),
        href: (a as HTMLAnchorElement).href || a.getAttribute("href") || "",
      }))
    );
    expect(links.length).toBe(2);
    expect(links.some((l) => l.text === "Example")).toBe(true);
    await page.close();
  });

  it("deve extrair imagens da página", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <img src="https://example.com/logo.png" alt="Logo" width="100" height="50">
    </body></html>`);
    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img[src]")).map((img) => ({
        src: (img as HTMLImageElement).src || img.getAttribute("src") || "",
        alt: img.getAttribute("alt") || "",
      }))
    );
    expect(images.length).toBe(1);
    expect(images[0].alt).toBe("Logo");
    await page.close();
  });

  it("deve extrair estrutura de headings", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <h1>Title</h1>
      <h2>Section</h2>
      <h3>Subsection</h3>
    </body></html>`);
    const headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
        level: h.tagName,
        text: (h.textContent || "").trim(),
      }))
    );
    expect(headings.length).toBe(3);
    expect(headings[0].level).toBe("H1");
    expect(headings[0].text).toBe("Title");
    await page.close();
  });
});

describe("Data — scrape_pages", () => {
  it("deve extrair dados com seletores CSS", async () => {
    const page = await browser.newPage();
    await page.setContent(`<html><body>
      <h1 class="title">Page Title</h1>
      <p class="price">R$ 99,90</p>
    </body></html>`);
    const data = await page.evaluate(() => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel);
        return el?.textContent?.trim() || null;
      };
      return { titulo: getText("h1.title"), preco: getText("p.price") };
    });
    expect(data.titulo).toBe("Page Title");
    expect(data.preco).toBe("R$ 99,90");
    await page.close();
  });
});

describe("Data — scrape_sitemap", () => {
  it("deve parsear XML de sitemap", async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2024-01-01</lastmod></url>
  <url><loc>https://example.com/about</loc><lastmod>2024-01-02</lastmod></url>
</urlset>`;
    const urls: Array<{ loc: string; lastmod: string | null }> = [];
    const locRe = /<loc[^>]*>([^<]+)<\/loc>/gi;
    const lastmodRe = /<lastmod[^>]*>([^<]+)<\/lastmod>/gi;
    let m: RegExpExecArray | null;
    while ((m = locRe.exec(sitemapXml)) !== null) {
      const lastmod = lastmodRe.exec(sitemapXml);
      urls.push({ loc: m[1].trim(), lastmod: lastmod ? lastmod[1].trim() : null });
      lastmodRe.lastIndex = 0;
    }
    expect(urls.length).toBe(2);
    expect(urls[0].loc).toBe("https://example.com/");
    expect(urls[1].loc).toBe("https://example.com/about");
  });

  it("deve parsear sitemap index com URLs aninhadas", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap2.xml</loc></sitemap>
</sitemapindex>`;
    const urls: string[] = [];
    const re = /<loc[^>]*>([^<]+)<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) urls.push(m[1].trim());
    expect(urls.length).toBe(2);
    expect(urls).toContain("https://example.com/sitemap1.xml");
  });
});

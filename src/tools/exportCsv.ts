import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const exportCsvTool: ToolDefinition = {
  name: "export_csv",
  description: "Extrai dados da página current e exporta como CSV. Suporta: tabelas HTML, dados de seletores customizados, ou lista de URLs/fontes/dados estruturados. Retorna CSV formatado como texto.",
  args: {
    mode: z.string().max(50).optional().describe("Modo de extração: 'table' (tabelas HTML), 'selectors' (seletores CSS), 'links' (todos os links), 'images' (todas as imagens), 'headings' (estrutura de títulos). Padrão: 'table'"),
    selectors: z.string().max(5000).optional().describe("JSON array de seletores CSS para modo 'selectors'. ex: [\"h1\", \".price\", \"meta[name=description]\"]"),
    columns: z.string().max(1000).optional().describe("Names das colunas (separated por vírgula) para modo 'selectors'. ex: 'titulo,preco,descricao'"),
    tableIndex: z.string().max(10).optional().describe("Índice da tabela na page (0-based), para pages with múltiplas tabelas"),
    delimiter: z.string().max(10).optional().describe("Delimitador do CSV (padrão: ',')"),
  },
  async execute(args: { mode?: string; selectors?: string; columns?: string; tableIndex?: string; delimiter?: string }) {
    const page = await getPage();
    const url = page.url();
    const mode = args.mode || "table";
    const delimiter = args.delimiter || ",";
    const escapeCsv = (val: string) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return str.includes(delimiter) || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
    };

    let csv = "";
    let totalRows = 0;

    if (mode === "table") {
      const tableIdx = parseInt(args.tableIndex || "0");
      const result = await page.evaluate((idx) => {
        const tables = document.querySelectorAll("table");
        const table = tables[idx];
        if (!table) return { error: `Tabela #${idx} não encontrada` };
        const rows = Array.from(table.querySelectorAll("tr"));
        const data = rows.map((row) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          return cells.map((c) => c.textContent?.trim() || "");
        });
        return { headers: data[0] || [], rows: data.slice(1) };
      }, tableIdx);

      if (result.error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: result.error }) }], isError: true };
      }
      if (!result.headers) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Tabela sem headers" }) }], isError: true };
      }

      csv = result.headers.map(escapeCsv).join(delimiter) + "\n";
      for (const row of result.rows || []) {
        csv += row.map(escapeCsv).join(delimiter) + "\n";
        totalRows++;
      }
    } else if (mode === "selectors") {
      const selectors: string[] = args.selectors ? JSON.parse(args.selectors) : ["h1", "h2", "p"];
      const columns: string[] = args.columns ? args.columns.split(",").map((s) => s.trim()) : selectors;

      csv = columns.map(escapeCsv).join(delimiter) + "\n";

      const maxLen = Math.max(...await Promise.all(selectors.map((sel) =>
        page.evaluate((s) => document.querySelectorAll(s).length, sel)
      )));

      for (let i = 0; i < maxLen; i++) {
        const row: string[] = [];
        for (let j = 0; j < selectors.length; j++) {
          const val = await page.evaluate(({ sel, idx }) => {
            const els = document.querySelectorAll(sel);
            const el = els[idx];
            if (!el) return "";
            if (el instanceof HTMLElement) return el.innerText?.trim() || el.textContent?.trim() || "";
            return el.textContent?.trim() || "";
          }, { sel: selectors[j], idx: i });
          row.push(escapeCsv(val));
        }
        csv += row.join(delimiter) + "\n";
        totalRows++;
      }
    } else if (mode === "links") {
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]")).map((a) => ({
          text: (a.textContent || "").trim().slice(0, 100),
          href: (a as HTMLAnchorElement).href || a.getAttribute("href") || "",
          rel: a.getAttribute("rel") || "",
          target: a.getAttribute("target") || "",
        }))
      );
      csv = "text,href,rel,target\n";
      for (const link of links) {
        csv += `${escapeCsv(link.text)},${escapeCsv(link.href)},${escapeCsv(link.rel)},${escapeCsv(link.target)}\n`;
        totalRows++;
      }
    } else if (mode === "images") {
      const images = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img[src]")).map((img) => ({
          src: (img as HTMLImageElement).src || img.getAttribute("src") || "",
          alt: img.getAttribute("alt") || "",
          width: (img as HTMLImageElement).naturalWidth || 0,
          height: (img as HTMLImageElement).naturalHeight || 0,
        }))
      );
      csv = "src,alt,width,height\n";
      for (const img of images) {
        csv += `${escapeCsv(img.src)},${escapeCsv(img.alt)},${img.width},${img.height}\n`;
        totalRows++;
      }
    } else if (mode === "headings") {
      const headings = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
          level: h.tagName,
          text: (h.textContent || "").trim().slice(0, 200),
          id: h.getAttribute("id") || "",
        }))
      );
      csv = "level,text,id\n";
      for (const h of headings) {
        csv += `${escapeCsv(h.level)},${escapeCsv(h.text)},${escapeCsv(h.id)}\n`;
        totalRows++;
      }
    }

    return {
      content: [
        { type: "text", text: JSON.stringify({ url, mode, totalRows, csv, filename: `${mode}_${Date.now()}.csv` }, null, 2) },
      ],
    };
  },
};

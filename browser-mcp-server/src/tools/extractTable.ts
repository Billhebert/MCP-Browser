import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const extractTableTool: ToolDefinition = {
  name: "extract_table",
  description:
    "Extrair tabelas HTML da página atual como dados estruturados (JSON). Detecta todas as tabelas (<table>, <table role='grid'>), extrai cabeçalhos e linhas, e retorna em formato array de objetos. Útil para scraping de dados tabulares.",
  args: {
    selector: z.string().optional().describe("Seletor CSS da tabela específica (padrão: todas as tabelas)"),
    format: z.string().optional().describe("Formato: 'json' (padrão), 'csv' (string CSV)"),
  },
  async execute(args: { selector?: string; format?: string }) {
    const page = await getPage();
    const url = page.url();
    const outputFormat = args.format || "json";

    const tables = await page.evaluate((sel) => {
      const selector = sel || "table";
      const results: Array<{
        index: number;
        id: string;
        caption: string;
        headers: string[];
        rows: Array<Record<string, string>>;
        rowCount: number;
        colCount: number;
      }> = [];

      const elements = document.querySelectorAll(selector);
      for (const [i, table] of Array.from(elements).entries()) {
        const rows = Array.from(table.querySelectorAll("tr"));
        const headerRow = rows[0];
        const headers: string[] = [];
        if (headerRow) {
          Array.from(headerRow.querySelectorAll("th, td")).forEach((cell) => {
            headers.push((cell.textContent || "").trim() || `col-${headers.length + 1}`);
          });
        }

        const dataRows = rows.slice(1).filter((r) => r.querySelectorAll("td, th").length > 0);
        const parsed: Array<Record<string, string>> = [];
        for (const row of dataRows) {
          const cells = Array.from(row.querySelectorAll("td, th"));
          const rowData: Record<string, string> = {};
          for (let j = 0; j < cells.length; j++) {
            rowData[headers[j] || `col-${j + 1}`] = (cells[j].textContent || "").trim();
          }
          parsed.push(rowData);
        }

        const caption = table.querySelector("caption")?.textContent?.trim() || "";
        results.push({
          index: i + 1,
          id: table.id || table.className?.slice(0, 30) || `table-${i + 1}`,
          caption,
          headers,
          rows: parsed,
          rowCount: parsed.length,
          colCount: headers.length,
        });
      }
      return results;
    }, args.selector || null);

    const totalTables = tables.length;
    const totalRows = tables.reduce((s, t) => s + t.rowCount, 0);

    if (outputFormat === "csv") {
      const csvLines: string[] = [];
      for (const table of tables) {
        csvLines.push(`# ${table.caption || `Table ${table.index}`}`);
        csvLines.push(table.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));
        for (const row of table.rows) {
          csvLines.push(table.headers.map((h) => `"${(row[h] || "").replace(/"/g, '""')}"`).join(","));
        }
        csvLines.push("");
      }
      return { content: [{ type: "text", text: csvLines.join("\n") }] };
    }

    console.error(`📊 Tables: ${totalTables} tables, ${totalRows} total rows`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url, totalTables, totalRows, tables,
      }, null, 2) }],
    };
  },
};

import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getConnection } from "./sqlConnect.js";
import fs from "node:fs";

export const sqlExecuteTool: ToolDefinition = {
  name: "sql_execute",
  description: "Executa comandos DML/DDL (INSERT, UPDATE, DELETE, CREATE TABLE, etc) no banco conectado. Retorna número de linhas afetadas. Para consultas SELECT, use sql_query.",
  args: {
    label: z.string().max(100).describe("Label da conexão (definida em sql_connect)"),
    sql: z.string().max(10000).describe("Comando SQL a executar"),
    params: z.string().max(5000).optional().describe("Parâmetros para query parametrizada (JSON array)"),
    file: z.string().max(2000).optional().describe("Path para file .sql with o withando"),
    saveSqlite: z.string().max(10).optional().describe("Para SQLite: salvar alterações em disco? 'true' (padrão: 'true')"),
  },
  async execute(args: { label: string; sql?: string; params?: string; file?: string; saveSqlite?: string }) {
    const conn = getConnection(args.label);
    if (!conn) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Conexão "${args.label}" não encontrada. Use sql_connect primeiro.` }) }], isError: true };
    }

    let sql = args.sql || "";
    if (args.file) {
      sql = fs.readFileSync(args.file, "utf-8");
    }
    if (!sql) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Forneça sql ou file" }) }], isError: true };
    }

    let params: any[] = [];
    if (args.params) {
      try { params = JSON.parse(args.params); } catch { params = []; }
    }

    try {
      let affectedRows = 0;

      if (conn.type === "postgres") {
        const res = await conn.client.query(sql, params);
        affectedRows = res.rowCount || 0;
      } else if (conn.type === "mysql") {
        const [r] = await conn.client.query(sql, params);
        affectedRows = (r as any).affectedRows || 0;
      } else {
        conn.client.run(sql, params);
        affectedRows = conn.client.getRowsModified();
        if (args.saveSqlite !== "false") {
          const data = conn.client.export();
          const buffer = Buffer.from(data);
          const dbPath = args.label.includes(".") ? args.label : `${args.label}.db`;
          fs.writeFileSync(dbPath, buffer);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, label: args.label, affectedRows, sql: sql.slice(0, 200) }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Execute failed: ${(err as Error).message}`, sql: sql.slice(0, 200) }) }],
        isError: true,
      };
    }
  },
};

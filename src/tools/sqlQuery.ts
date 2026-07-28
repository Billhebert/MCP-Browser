import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getConnection } from "./sqlConnect.js";

export const sqlQueryTool: ToolDefinition = {
  name: "sql_query",
  description: "Executa uma consulta SELECT no banco de dados conectado via sql_connect. Retorna resultados como array de objetos JSON. Suporta PostgreSQL, MySQL e SQLite.",
  args: {
    label: z.string().max(100).describe("Label da conexão (definida em sql_connect)"),
    sql: z.string().max(10000).describe("Consulta SQL SELECT"),
    params: z.string().max(5000).optional().describe("Parâmetros para query parametrizada (JSON array)"),
    limit: z.string().max(10).optional().describe("Limite maximum de linhas (default: 100)"),
  },
  async execute(args: { label: string; sql: string; params?: string; limit?: string }) {
    const conn = getConnection(args.label);
    if (!conn) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Conexão "${args.label}" não encontrada. Use sql_connect primeiro.` }) }], isError: true };
    }

    const sql = args.sql.trim().toUpperCase().startsWith("SELECT") ? args.sql : `SELECT * FROM (${args.sql}) _sub LIMIT ${parseInt(args.limit || "100")}`;
    let params: any[] = [];
    if (args.params) {
      try { params = JSON.parse(args.params); } catch { params = []; }
    }

    const maxRows = parseInt(args.limit || "100");

    try {
      let rows: any[] = [];
      let fields: string[] = [];
      let rowCount = 0;

      if (conn.type === "postgres") {
        const res = await conn.client.query(sql, params);
        rows = res.rows.slice(0, maxRows);
        fields = res.fields?.map((f: any) => f.name) || [];
        rowCount = res.rowCount || 0;
      } else if (conn.type === "mysql") {
        const [r] = await conn.client.query(sql, params);
        rows = (r as any[]).slice(0, maxRows);
        fields = rows.length > 0 ? Object.keys(rows[0]) : [];
        rowCount = rows.length;
      } else {
        const stmt = conn.client.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const result: any[] = [];
        const cols: string[] = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          if (cols.length === 0) cols.push(...Object.keys(row));
          result.push(row);
          if (result.length >= maxRows) break;
        }
        stmt.free();
        rows = result;
        fields = cols;
        rowCount = result.length;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              label: args.label,
              fields,
              rowCount,
              rows,
              sql: args.sql,
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Query failed: ${(err as Error).message}`, sql: args.sql }) }],
        isError: true,
      };
    }
  },
};

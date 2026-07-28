import { z } from "zod";
import type { ToolDefinition } from "../types.js";

interface Connection {
  client: any;
  type: string;
}

const connections = new Map<string, Connection>();

export function getConnection(label: string): Connection | undefined {
  return connections.get(label);
}

export const sqlConnectTool: ToolDefinition = {
  name: "sql_connect",
  description: "Conecta a um banco de dados PostgreSQL, MySQL ou SQLite via connection string. Armazena a conexão com um label para uso posterior com sql_query e sql_execute. Retorna status da conexão e informações do banco.",
  args: {
    connectionString: z.string().max(5000).describe("Connection string. Ex: postgresql://user:pass@localhost:5432/db, mysql://user:pass@localhost:3306/db, ou path para file SQLite"),
    label: z.string().max(100).describe("Label único para identificar esta conexão"),
    type: z.string().max(20).optional().describe("Tipo: 'postgres', 'mysql', ou 'sqlite'. Se omitido, detecta pela connection string"),
  },
  async execute(args: { connectionString: string; label: string; type?: string }) {
    const { connectionString, label } = args;
    let type = args.type || "";

    if (!type) {
      if (connectionString.startsWith("postgresql://") || connectionString.startsWith("postgres://")) type = "postgres";
      else if (connectionString.startsWith("mysql://")) type = "mysql";
      else type = "sqlite";
    }

    try {
      let client: any;
      let dbInfo: Record<string, any> = {};

      if (type === "postgres") {
        const { default: pg } = await import("pg");
        client = new pg.Client({ connectionString });
        await client.connect();
        const res = await client.query("SELECT version() as v");
        dbInfo.version = res.rows[0]?.v || "";
        const dbRes = await client.query("SELECT current_database() as db");
        dbInfo.database = dbRes.rows[0]?.db || "";
      } else if (type === "mysql") {
        const mysql = await import("mysql2/promise");
        const url = new URL(connectionString);
        client = await mysql.createConnection({
          host: url.hostname,
          port: parseInt(url.port) || 3306,
          user: url.username,
          password: url.password,
          database: url.pathname.replace("/", ""),
        });
        const [rows] = await client.query("SELECT VERSION() as v");
        dbInfo.version = (rows as any[])[0]?.v || "";
        dbInfo.database = url.pathname.replace("/", "");
      } else {
        const initSqlJs = (await import("sql.js")).default;
        const fs = await import("node:fs");
        const SQL = await initSqlJs();
        const buffer = fs.existsSync(connectionString) ? fs.readFileSync(connectionString) : undefined;
        client = buffer ? new SQL.Database(buffer) : new SQL.Database();
        dbInfo.version = "SQLite (sql.js)";
        dbInfo.database = connectionString;
      }

      connections.set(label, { client, type });
      console.error(`🗄️ Connected to ${type}:${label}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, label, type, ...dbInfo }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Falha ao conectar: ${(err as Error).message}` }) }],
        isError: true,
      };
    }
  },
};

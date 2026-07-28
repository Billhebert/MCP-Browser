import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getConnection } from "./sqlConnect.js";

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  pk: boolean;
}

interface ForeignKeyInfo {
  column: string;
  refTable: string;
  refColumn: string;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  foreignKeys: ForeignKeyInfo[];
  indexes: string[];
}

export const sqlSchemaTool: ToolDefinition = {
  name: "sql_schema",
  description: "Inspect database schema: list all tables, columns, types, primary keys, foreign keys, indexes, and row counts. Returns structured JSON for visualization.",
  args: {
    label: z.string().max(100).describe("Connection label (from sql_connect)"),
    includeRowCounts: z.boolean().optional().describe("Count rows for each table. Default: true (can be slow on large DBs)"),
  },
  async execute(args: { label: string; includeRowCounts?: boolean }) {
    const conn = getConnection(args.label);
    if (!conn) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Connection "${args.label}" not found` }) }], isError: true };
    }

    const countRows = args.includeRowCounts !== false;
    const tables: TableInfo[] = [];
    const relationships: Array<{ from: { table: string; column: string }; to: { table: string; column: string }; type: string }> = [];

    try {
      let tableNames: string[] = [];

      if (conn.type === "postgres") {
        const tRes = await conn.client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
        tableNames = tRes.rows.map((r: any) => r.table_name);

        for (const name of tableNames) {
          const cRes = await conn.client.query(
            `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
            [name]
          );
          const pkRes = await conn.client.query(
            `SELECT kcu.column_name FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
            [name]
          );
          const fkRes = await conn.client.query(
            `SELECT kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
             WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
            [name]
          );
          const iRes = await conn.client.query(
            `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
            [name]
          );

          const pkCols = new Set(pkRes.rows.map((r: any) => r.column_name));
          const columns: ColumnInfo[] = cRes.rows.map((r: any) => ({
            name: r.column_name, type: r.data_type,
            nullable: r.is_nullable === "YES",
            default: r.column_default, pk: pkCols.has(r.column_name),
          }));
          const foreignKeys: ForeignKeyInfo[] = fkRes.rows.map((r: any) => ({ column: r.column_name, refTable: r.ref_table, refColumn: r.ref_column }));
          const indexes: string[] = iRes.rows.map((r: any) => r.indexname);
          let rowCount = 0;
          if (countRows) {
            try {
              const rRes = await conn.client.query(`SELECT COUNT(*) as cnt FROM "${name}"`);
              rowCount = parseInt(rRes.rows[0]?.cnt) || 0;
            } catch {}
          }
          tables.push({ name, columns, rowCount, foreignKeys, indexes });
          for (const fk of foreignKeys) {
            relationships.push({ from: { table: name, column: fk.column }, to: { table: fk.refTable, column: fk.refColumn }, type: "many-to-one" });
          }
        }
      } else if (conn.type === "mysql") {
        const [rows] = await conn.client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name`);
        tableNames = (rows as any[]).map((r: any) => r.table_name);

        for (const name of tableNames) {
          const [cRows] = await conn.client.query(
            `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position`,
            [name]
          );
          const [pkRows] = await conn.client.query(
            `SELECT kcu.column_name FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             WHERE tc.table_name = ? AND tc.constraint_type = 'PRIMARY KEY'`,
            [name]
          );
          const [fkRows] = await conn.client.query(
            `SELECT kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
             WHERE tc.table_name = ? AND tc.constraint_type = 'FOREIGN KEY'`,
            [name]
          );
          const [iRows] = await conn.client.query(`SHOW INDEX FROM \`${name}\``);
          const pkCols = new Set((pkRows as any[]).map((r: any) => r.column_name));
          const columns: ColumnInfo[] = (cRows as any[]).map((r: any) => ({
            name: r.column_name, type: r.data_type,
            nullable: r.is_nullable === "YES",
            default: r.column_default, pk: pkCols.has(r.column_name),
          }));
          const foreignKeys: ForeignKeyInfo[] = (fkRows as any[]).map((r: any) => ({ column: r.column_name, refTable: r.ref_table, refColumn: r.ref_column }));
          const indexNames = [...new Set((iRows as any[]).map((r: any) => r.Key_name))];
          let rowCount = 0;
          if (countRows) {
            try { const [rRows] = await conn.client.query(`SELECT COUNT(*) as cnt FROM \`${name}\``); rowCount = parseInt((rRows as any[])[0]?.cnt) || 0; } catch {}
          }
          tables.push({ name, columns, rowCount, foreignKeys, indexes: indexNames });
          for (const fk of foreignKeys) relationships.push({ from: { table: name, column: fk.column }, to: { table: fk.refTable, column: fk.refColumn }, type: "many-to-one" });
        }
      } else {
        const stmt = conn.client.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        const tRows: any[] = [];
        while (stmt.step()) tRows.push(stmt.getAsObject());
        stmt.free();
        tableNames = tRows.map((r: any) => r.name);

        for (const name of tableNames) {
          const ciStmt = conn.client.prepare(`PRAGMA table_info("${name}")`);
          const cRows: any[] = [];
          while (ciStmt.step()) cRows.push(ciStmt.getAsObject());
          ciStmt.free();
          const fiStmt = conn.client.prepare(`PRAGMA foreign_key_list("${name}")`);
          const fRows: any[] = [];
          while (fiStmt.step()) fRows.push(fiStmt.getAsObject());
          fiStmt.free();
          const iiStmt = conn.client.prepare(`PRAGMA index_list("${name}")`);
          const iRows: any[] = [];
          while (iiStmt.step()) iRows.push(iiStmt.getAsObject());
          iiStmt.free();

          const columns: ColumnInfo[] = cRows.map((r: any) => ({
            name: r.name, type: r.type || "TEXT",
            nullable: !r.notnull, default: r.dflt_value,
            pk: r.pk === 1,
          }));
          const foreignKeys: ForeignKeyInfo[] = fRows.map((r: any) => ({ column: r.from, refTable: r.table, refColumn: r.to }));
          const indexes = iRows.filter((r: any) => !r.unique).map((r: any) => r.name);
          let rowCount = 0;
          if (countRows) {
            try { const rStmt = conn.client.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`); if (rStmt.step()) rowCount = rStmt.getAsObject().cnt || 0; rStmt.free(); } catch {}
          }
          tables.push({ name, columns, rowCount, foreignKeys, indexes });
          for (const fk of foreignKeys) relationships.push({ from: { table: name, column: fk.column }, to: { table: fk.refTable, column: fk.refColumn }, type: "many-to-one" });
        }
      }

      const totalRows = tables.reduce((s, t) => s + t.rowCount, 0);

      return {
        content: [{ type: "text", text: JSON.stringify({
          database: args.label, type: conn.type,
          totalTables: tables.length,
          totalRows,
          tables,
          relationships,
          mermaid: generateMermaidER(tables, relationships, conn.type),
        }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Schema inspection failed: ${(err as Error).message}` }) }], isError: true };
    }
  },
};

function generateMermaidER(tables: TableInfo[], relationships: Array<{ from: { table: string; column: string }; to: { table: string; column: string }; type: string }>, type: string): string {
  let mermaid = "erDiagram\n";
  for (const table of tables) {
    mermaid += `    ${sanitize(table.name)} {\n`;
    for (const col of table.columns) {
      const pk = col.pk ? " PK" : "";
      const fk = relationships.some((r) => r.from.table === table.name && r.from.column === col.name) ? " FK" : "";
      const nullable = col.nullable ? "" : "";
      mermaid += `        ${mapType(col.type, type)} ${sanitize(col.name)}${pk}${fk}\n`;
    }
    mermaid += `    }\n`;
  }
  for (const rel of relationships) {
    mermaid += `    ${sanitize(rel.from.table)} }o--|| ${sanitize(rel.to.table)} : "${rel.from.column}"\n`;
  }
  return mermaid;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function mapType(type: string, dbType: string): string {
  const t = type.toLowerCase();
  if (t.includes("int") || t.includes("serial") || t.includes("bool")) return "int";
  if (t.includes("char") || t.includes("text") || t.includes("clob") || t.includes("uuid")) return "string";
  if (t.includes("float") || t.includes("double") || t.includes("real") || t.includes("numeric") || t.includes("decimal")) return "float";
  if (t.includes("date") || t.includes("time") || t.includes("timestamp")) return "date";
  return "string";
}

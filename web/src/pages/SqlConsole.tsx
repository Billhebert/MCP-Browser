import { useState, useCallback, useRef } from "react";
import { api } from "../api/client.ts";
import SchemaDiagram from "../components/SchemaDiagram.tsx";

export default function SqlConsole() {
  const [connectionString, setConnectionString] = useState("sqlite://meu-banco.db");
  const [label, setLabel] = useState("default");
  const [connected, setConnected] = useState(false);
  const [sql, setSql] = useState("SELECT sqlite_version() as version");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"query" | "schema">("query");
  const [schemaData, setSchemaData] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.executeTool("sql_connect", { connectionString, label, type: connectionString.startsWith("postgres") ? "postgres" : connectionString.startsWith("mysql") ? "mysql" : "sqlite" });
      setConnected(res.success);
      if (!res.success) setResult({ error: (res.content?.[0] as any)?.text || "Connection failed" });
      else setResult({ message: `Connected: ${label}` });
    } catch (err) { setResult({ error: (err as Error).message }); }
    setLoading(false);
  }, [connectionString, label]);

  const query = useCallback(async () => {
    setLoading(true);
    try {
      const isSelect = sql.trim().toUpperCase().startsWith("SELECT") || sql.trim().toUpperCase().startsWith("WITH") || sql.trim().toUpperCase().startsWith("PRAGMA");
      const tool = isSelect ? "sql_query" : "sql_execute";
      const res = await api.executeTool(tool, { label, sql });
      setResult(res);
    } catch (err) { setResult({ error: (err as Error).message }); }
    setLoading(false);
  }, [label, sql]);

  const loadSchema = useCallback(async () => {
    if (!connected) return;
    setSchemaLoading(true);
    try {
      const res = await api.executeTool("sql_schema", { label });
      const text = res.content?.[0]?.text || "{}";
      const data = JSON.parse(text);
      setSchemaData(data);
    } catch (err) { setSchemaData({ error: (err as Error).message }); }
    setSchemaLoading(false);
  }, [label, connected]);

  const keyMap = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") query();
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">SQL Console</h1>
        <p className="text-sm text-gray-600 mt-0.5">Connect to PostgreSQL, MySQL, or SQLite databases and run queries directly from the browser</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Connection String</label>
            <input type="text" className="w-full bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono" placeholder="postgresql://user:pass@localhost:5432/db" value={connectionString} onChange={(e) => setConnectionString(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Label</label>
            <div className="flex gap-2">
              <input type="text" className="flex-1 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" value={label} onChange={(e) => setLabel(e.target.value)} />
              <button onClick={connect} disabled={loading} className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">{connected ? "Reconnect" : "Connect"}</button>
            </div>
          </div>
        </div>
        {connected && <div className="text-xs text-green-400">✅ Connected: {label}</div>}
      </div>

      <div className="bg-gray-900/50 border-b border-gray-800/50 rounded-t-xl flex">
        <button onClick={() => setActiveTab("query")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "query" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>📝 Query</button>
        <button onClick={() => { setActiveTab("schema"); if (!schemaData && connected) loadSchema(); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "schema" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>📊 Schema</button>
      </div>

      {activeTab === "query" && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4 space-y-3">
            <label className="block text-xs font-medium">SQL Query <span className="text-gray-600">(Ctrl+Enter to run)</span></label>
            <textarea className="w-full h-[120px] bg-gray-950 border border-gray-700/50 rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-blue-500/50 resize-none" value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={keyMap} placeholder="SELECT * FROM users LIMIT 10" />
            <button onClick={query} disabled={loading || !connected} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${loading || !connected ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>{loading ? "Running..." : "▶ Execute"}</button>
          </div>

          {result && !loading && (
            <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4 overflow-auto max-h-[500px]">
              {result.error ? (
                <div className="text-red-400 text-sm">{result.error}</div>
              ) : result.message ? (
                <div className="text-green-400 text-sm">{result.message}</div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800/50">
                    <span className="text-sm font-medium text-green-400">Query executed</span>
                    <span className="text-xs text-gray-500">{result.duration}ms</span>
                  </div>
                  {(() => {
                    try {
                      const text = result.content?.[0]?.text || "{}";
                      const data = JSON.parse(text);
                      if (data.error) return <div className="text-red-400 text-sm">{data.error}</div>;
                      if (data.affectedRows !== undefined) return <div className="text-sm text-gray-300">{data.affectedRows} row(s) affected</div>;
                      if (data.rows) {
                        return (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-gray-700">{data.fields?.map((f: string) => <th key={f} className="text-left px-2 py-1 text-gray-500 font-medium">{f}</th>)}</tr></thead>
                              <tbody>{data.rows.map((row: any, i: number) => <tr key={i} className="border-b border-gray-800">{data.fields?.map((f: string) => <td key={f} className="px-2 py-1 text-gray-300 font-mono">{String(row[f] ?? "NULL")}</td>)}</tr>)}</tbody>
                            </table>
                            <div className="text-xs text-gray-600 mt-2">{data.rowCount} row(s)</div>
                          </div>
                        );
                      }
                      return <pre className="text-sm font-mono whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
                    } catch { return <pre className="text-sm font-mono whitespace-pre-wrap">{(result.content?.[0] as any)?.text || "No result"}</pre>; }
                  })()}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "schema" && (
        <div className="space-y-4">
          {!connected ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-12 text-center">
              <div className="text-3xl mb-3">🗄️</div>
              <p className="text-sm text-gray-600">Connect to a database first to view its schema.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button onClick={loadSchema} disabled={schemaLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors">
                  {schemaLoading ? "Loading..." : "⟳ Refresh Schema"}
                </button>
                {schemaData?.totalTables !== undefined && (
                  <span className="text-xs text-gray-500">{schemaData.totalTables} tables · {schemaData.totalRows?.toLocaleString()} rows · {schemaData.type}</span>
                )}
              </div>

              {schemaLoading && (
                <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-8 text-center">
                  <div className="animate-pulse text-gray-600 text-sm">Inspecting database schema...</div>
                </div>
              )}

              {schemaData?.error && (
                <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm">{schemaData.error}</div>
              )}

              {schemaData?.tables && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SchemaDiagram mermaidCode={schemaData.mermaid || ""} title="Entity Relationship Diagram" />
                  <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4 overflow-auto max-h-[500px]">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tables</h3>
                    <div className="space-y-2">
                      {schemaData.tables.map((table: any) => (
                        <div key={table.name} className="bg-gray-800/40 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-200">{table.name}</span>
                            <span className="text-xs text-gray-500">{table.rowCount.toLocaleString()} rows</span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            {table.columns.slice(0, 5).map((col: any) => (
                              <div key={col.name} className="flex items-center gap-2">
                                <span className={`w-1 h-1 rounded-full ${col.pk ? "bg-yellow-500" : "bg-gray-600"}`} />
                                <span className={col.pk ? "text-yellow-400 font-medium" : "text-gray-400"}>{col.name}</span>
                                <span className="text-gray-700">{col.type}</span>
                                {col.pk && <span className="text-[10px] bg-yellow-900/40 text-yellow-500 px-1 rounded">PK</span>}
                                {schemaData.relationships?.some((r: any) => r.from.table === table.name && r.from.column === col.name) && (
                                  <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1 rounded">FK</span>
                                )}
                              </div>
                            ))}
                            {table.columns.length > 5 && <div className="text-gray-700 mt-1">...{table.columns.length - 5} more columns</div>}
                          </div>
                          {table.foreignKeys?.length > 0 && (
                            <div className="mt-2 text-xs text-gray-700">
                              {table.foreignKeys.map((fk: any) => (
                                <div key={fk.column}>↦ <span className="text-blue-400">{fk.column}</span> → <span className="text-green-400">{fk.refTable}.{fk.refColumn}</span></div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

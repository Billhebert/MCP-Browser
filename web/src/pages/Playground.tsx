import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type ToolInfo, type ToolResult } from "../api/client.ts";
import { Skeleton } from "../components/Skeleton.tsx";
import { useToast } from "../components/Toast.tsx";

function tryFormatJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

export default function Playground() {
  const { toolName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ToolResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [view, setView] = useState<"formatted" | "raw">("formatted");

  useEffect(() => {
    api.listTools()
      .then((list) => {
        setTools(list);
        if (toolName) {
          const found = list.find((t) => t.name === toolName);
          if (found) { setSelectedTool(found); setArgs({}); setResult(null); }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [toolName]);

  const filtered = useMemo(() =>
    tools.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    ),
    [tools, search]
  );

  const selectTool = useCallback((tool: ToolInfo) => {
    setSelectedTool(tool);
    setArgs({});
    setResult(null);
    setView("formatted");
    navigate(`/playground/${tool.name}`, { replace: true });
  }, [navigate]);

  const execute = useCallback(async () => {
    if (!selectedTool) return;
    setExecuting(true);
    setResult(null);

    const parsed: Record<string, unknown> = {};
    for (const arg of selectedTool.args) {
      const val = args[arg.name]?.trim();
      if (!val && !arg.required) continue;
      if (arg.type === "number") parsed[arg.name] = val ? Number(val) : undefined;
      else if (arg.type === "boolean") parsed[arg.name] = val === "true" || val === "1";
      else if (arg.type === "array") {
        try { parsed[arg.name] = JSON.parse(val || "[]"); } catch { parsed[arg.name] = (val || "").split(",").map((s) => s.trim()); }
      } else parsed[arg.name] = val || undefined;
    }

    try {
      const res = await api.executeTool(selectedTool.name, parsed);
      setResult(res);
      toast(res.success ? "success" : "error", `${selectedTool.name} — ${res.success ? `${res.duration}ms` : res.error?.slice(0, 60) || "failed"}`);
    } catch (err) {
      setResult({ success: false, duration: 0, content: [], isError: true, error: (err as Error).message });
      toast("error", `${selectedTool.name} — ${(err as Error).message}`);
    }
    setExecuting(false);
  }, [selectedTool, args]);

  const hasRequired = selectedTool?.args.some((a) => a.required);
  const missingRequired = hasRequired && selectedTool?.args.some((a) => a.required && !args[a.name]?.trim());
  const canExecute = selectedTool && !executing && !missingRequired;

  return (
    <div className="flex h-full">
      <div className="w-64 bg-gray-900/50 border-r border-gray-800/50 flex flex-col overflow-hidden shrink-0">
        <div className="p-3 border-b border-gray-800/50">
          <input
            type="text"
            placeholder="Search tools..."
            className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder-gray-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-red-400">
              <div className="mb-2">Failed to load tools</div>
              <button onClick={() => { setLoading(true); setError(null); api.listTools().then(setTools).catch((e) => setError(e.message)).finally(() => setLoading(false)); }} className="text-xs text-blue-400 hover:underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-600">No tools match "{search}"</div>
          ) : (
            filtered.map((tool) => (
              <button
                key={tool.name}
                onClick={() => selectTool(tool)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-800/30 hover:bg-gray-800/40 transition-all duration-100 ${
                  selectedTool?.name === tool.name ? "bg-blue-600/10 border-l-2 border-l-blue-500" : "border-l-2 border-l-transparent"
                }`}
              >
                <div className="font-medium truncate text-gray-200">{tool.name}</div>
                <div className="text-xs text-gray-600 truncate mt-0.5">{tool.description.slice(0, 70)}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedTool ? (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="text-4xl mb-3">🔧</div>
              <p className="text-sm">Select a tool from the sidebar</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">{selectedTool.name}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{selectedTool.description}</p>
            </div>

            {selectedTool.args.length > 0 && (
              <div className="mb-6 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Arguments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTool.args.map((arg) => (
                    <div key={arg.name} className="bg-gray-900/60 border border-gray-800/50 rounded-lg p-3">
                      <label className="block text-xs font-medium mb-1.5 text-gray-400">
                        {arg.name}
                        {arg.required && <span className="text-red-400 ml-1">*</span>}
                        <span className="text-gray-700 ml-2">({arg.type})</span>
                      </label>
                      {arg.type === "boolean" ? (
                        <select
                          className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500/50"
                          value={args[arg.name] || ""}
                          onChange={(e) => setArgs((a) => ({ ...a, [arg.name]: e.target.value }))}
                        >
                          <option value="">—</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <textarea
                          className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500/50 font-mono resize-none"
                          rows={1}
                          placeholder={arg.description}
                          value={args[arg.name] || ""}
                          onChange={(e) => {
                            setArgs((a) => ({ ...a, [arg.name]: e.target.value }));
                            e.target.style.height = "auto";
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={execute}
                disabled={!canExecute}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  !canExecute
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98]"
                }`}
              >
                {executing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing...
                  </span>
                ) : (
                  "▶ Execute"
                )}
              </button>
            </div>

            {executing && (
              <div className="bg-gray-900/60 rounded-xl border border-gray-800/50 p-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <div className="text-sm text-gray-500">Executing tool...</div>
              </div>
            )}

            {result && !executing && (
              <div className="bg-gray-900/60 rounded-xl border border-gray-800/50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${result.success ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-sm font-medium">{result.success ? "Success" : "Error"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
                      <button onClick={() => setView("formatted")} className={`px-2 py-0.5 text-xs rounded transition-colors ${view === "formatted" ? "bg-gray-700 text-gray-200" : "text-gray-600 hover:text-gray-400"}`}>Formatted</button>
                      <button onClick={() => setView("raw")} className={`px-2 py-0.5 text-xs rounded transition-colors ${view === "raw" ? "bg-gray-700 text-gray-200" : "text-gray-600 hover:text-gray-400"}`}>Raw</button>
                    </div>
                    <span className="text-xs text-gray-600">{result.duration}ms</span>
                  </div>
                </div>
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  {result.content?.map((c, i) => (
                    <div key={i}>
                      {c.type === "image" && c.data ? (
                        <img src={`data:${c.mimeType || "image/png"};base64,${c.data}`} alt="result" className="max-w-full rounded-lg" />
                      ) : view === "raw" ? (
                        <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-300">{c.text || ""}</pre>
                      ) : (
                        <div className="text-sm font-mono whitespace-pre-wrap overflow-x-auto text-gray-300">{tryFormatJson(c.text || "")}</div>
                      )}
                    </div>
                  ))}
                  {result.error && (
                    <div className="bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-2 text-sm text-red-400 mt-2">{result.error}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

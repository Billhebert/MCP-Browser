import { useState, useCallback } from "react";
import { api, type ToolResult } from "../api/client.ts";

interface ToolCard {
  key: string;
  label: string;
  icon: string;
  description: string;
  args: Record<string, { label: string; type: string; default?: string; placeholder?: string; optional?: boolean }>;
}

const TOOLS: ToolCard[] = [
  {
    key: "storybook_scan",
    label: "Scan Components",
    icon: "📚",
    description: "Cataloga todos os componentes, variantes e metadados do Storybook",
    args: {
      url: { label: "Storybook URL", type: "text", placeholder: "http://localhost:6006" },
      maxStories: { label: "Max Stories", type: "number", default: "200", optional: true },
      detail: { label: "Detail Level", type: "select", default: "basic", optional: true },
    },
  },
  {
    key: "storybook_audit_a11y",
    label: "A11Y Audit",
    icon: "♿",
    description: "Testa acessibilidade (axe-core) em todas as stories com score por componente",
    args: {
      url: { label: "Storybook URL", type: "text", placeholder: "http://localhost:6006" },
      maxStories: { label: "Max Stories", type: "number", default: "50", optional: true },
      wcagLevel: { label: "WCAG Level", type: "select", default: "aa", optional: true },
    },
  },
  {
    key: "storybook_visual_diff",
    label: "Visual Diff",
    icon: "👁️",
    description: "Regressão visual: captura screenshot de cada story e compara com baseline",
    args: {
      url: { label: "Storybook URL", type: "text", placeholder: "http://localhost:6006" },
      maxStories: { label: "Max Stories", type: "number", default: "30", optional: true },
      threshold: { label: "Diff Threshold", type: "number", default: "0.1", optional: true },
      updateBaselines: { label: "Update Baselines", type: "boolean", default: "false", optional: true },
    },
  },
  {
    key: "storybook_perf",
    label: "Performance",
    icon: "⚡",
    description: "Métricas LCP/FCP/CLS/resources por story com ranking dos mais pesados",
    args: {
      url: { label: "Storybook URL", type: "text", placeholder: "http://localhost:6006" },
      maxStories: { label: "Max Stories", type: "number", default: "30", optional: true },
    },
  },
  {
    key: "test_components",
    label: "Run All Checks",
    icon: "🚀",
    description: "Meta-tool: executa scan + a11y + visual diff + perf em lote. Dashboard consolidado.",
    args: {
      url: { label: "Storybook URL", type: "text", placeholder: "http://localhost:6006" },
      maxStories: { label: "Max Stories", type: "number", default: "20", optional: true },
      checks: { label: "Checks", type: "text", default: "all", placeholder: "scan,a11y,visualdiff,perf or all", optional: true },
      updateBaselines: { label: "Update Baselines", type: "boolean", default: "false", optional: true },
    },
  },
];

function tryFormatJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

function ResultViewer({ result }: { result: ToolResult }) {
  const text = result.content?.[0]?.text || "";

  const renderStructured = () => {
    try {
      const data = JSON.parse(text);

      if (data.totalStories !== undefined) {
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Stories</div>
                <div className="text-lg font-bold">{data.totalStories}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Components</div>
                <div className="text-lg font-bold">{data.totalComponents ?? data.componentSummary?.length ?? "—"}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Score</div>
                <div className="text-lg font-bold">{data.overallScore ?? data.averageScore ?? "—"}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Violations</div>
                <div className="text-lg font-bold">{data.totalViolations ?? data.regressions ?? "—"}</div>
              </div>
            </div>

            {data.componentSummary && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Component Summary</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {data.componentSummary.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1">
                      <span>{c.component}</span>
                      <span className="text-gray-500">{c.stories} stories</span>
                      <span className={c.averageScore >= 80 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{c.averageScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.results && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Results</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {data.results.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1">
                      <span className="truncate flex-1">{r.story || r.component}</span>
                      <span className={`ml-2 font-bold ${r.score >= 80 ? "text-green-400" : "text-red-400"}`}>{r.score}</span>
                      {r.violationCount !== undefined && <span className="ml-2 text-gray-500">{r.violationCount} violations</span>}
                      {r.status && <span className={`ml-2 ${r.status === "identical" ? "text-green-400" : r.status === "baseline_created" ? "text-blue-400" : "text-yellow-400"}`}>{r.status}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.components && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Components</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {data.components.map((c: any, i: number) => (
                    <div key={i} className="text-xs bg-gray-800 rounded px-2 py-1">
                      <span className="font-medium">{c.component}</span>
                      <span className="text-gray-500 ml-2">({c.variants} variants)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recommendations && data.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {data.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-xs bg-gray-800 rounded px-2 py-1 text-gray-300">◆ {r}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.slowestStories && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Slowest Stories</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {data.slowestStories.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1">
                      <span className="truncate flex-1">{s.story}</span>
                      <span className="ml-2 text-gray-500">LCP: {s.lcp}</span>
                      <span className="ml-2 font-bold">{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }

      if (data.stories) {
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Stories</div>
                <div className="text-lg font-bold">{data.totalStories || data.stories.length}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Components</div>
                <div className="text-lg font-bold">{data.totalComponents || data.components?.length || "—"}</div>
              </div>
            </div>
            {data.components && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {data.components.slice(0, 30).map((c: any, i: number) => (
                  <div key={i} className="text-xs bg-gray-800 rounded px-2 py-1 flex justify-between">
                    <span>{c.component}</span>
                    <span className="text-gray-500">{c.variants} variants</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      return <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>;
    } catch {
      return <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">{text}</pre>;
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${result.success ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm font-medium">{result.success ? "Success" : "Error"}</span>
        </div>
        <span className="text-xs text-gray-500">{result.duration}ms</span>
      </div>
      <div className="p-4">{renderStructured()}</div>
      {result.content?.map((c, i) =>
        c.type === "image" && c.data ? (
          <img key={i} src={`data:${c.mimeType || "image/png"};base64,${c.data}`} alt="result" className="max-w-full rounded px-4 pb-4" />
        ) : null
      )}
      {result.error && <div className="text-red-400 text-sm px-4 pb-4">{result.error}</div>}
    </div>
  );
}

export default function Storybook() {
  const [url, setUrl] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [args, setArgs] = useState<Record<string, Record<string, string>>>({});
  const [results, setResults] = useState<Record<string, ToolResult | null>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<string | null>(null);

  const setToolArg = useCallback((tool: string, key: string, value: string) => {
    setArgs((prev) => ({ ...prev, [tool]: { ...(prev[tool] || {}), [key]: value } }));
  }, []);

  const executeTool = useCallback(async (toolKey: string) => {
    const tool = TOOLS.find((t) => t.key === toolKey);
    if (!tool) return;

    setLoading(toolKey);
    setActiveResult(toolKey);
    setResults((r) => ({ ...r, [toolKey]: null }));

    const toolArgs: Record<string, unknown> = {};
    const toolArgValues = args[toolKey] || {};
    for (const [key, argDef] of Object.entries(tool.args)) {
      const val = toolArgValues[key] || argDef.default || "";
      if (argDef.type === "number") toolArgs[key] = val ? Number(val) : undefined;
      else if (argDef.type === "boolean") toolArgs[key] = val === "true";
      else toolArgs[key] = val || undefined;
    }

    try {
      const res = await api.executeTool(toolKey, toolArgs);
      setResults((r) => ({ ...r, [toolKey]: res }));
    } catch (err) {
      setResults((r) => ({
        ...r,
        [toolKey]: { success: false, duration: 0, content: [], isError: true, error: (err as Error).message },
      }));
    }
    setLoading(null);
  }, [args]);

  const executeAll = useCallback(async () => {
    for (const tool of TOOLS) {
      if (tool.key === "test_components") continue;
      await executeTool(tool.key);
    }
    await executeTool("test_components");
  }, [executeTool]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Storybook</h1>
          <p className="text-sm text-gray-600 mt-0.5">Scan, audit accessibility, visual diff, and measure performance of Storybook components</p>
        </div>
        <button
          onClick={executeAll}
          disabled={!url || loading !== null}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Running..." : "▶ Run All Checks"}
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <label className="block text-sm font-medium mb-1">Storybook URL</label>
        <div className="flex gap-3">
          <input
            type="url"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            placeholder="http://localhost:6006"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              for (const t of TOOLS) {
                setToolArg(t.key, "url", e.target.value);
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const isRunning = loading === tool.key;
          const hasResult = results[tool.key] !== undefined && results[tool.key] !== null;

          return (
            <div
              key={tool.key}
              className={`bg-gray-900 rounded-xl border cursor-pointer transition-all ${
                activeResult === tool.key && hasResult ? "border-blue-500 ring-1 ring-blue-500/50" : "border-gray-800 hover:border-gray-700"
              }`}
              onClick={() => {
                setActiveTool(tool.key);
                setActiveResult(tool.key);
              }}
            >
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tool.icon}</span>
                    <h3 className="font-semibold">{tool.label}</h3>
                  </div>
                  {hasResult && (
                    <span className={`text-xs font-bold ${results[tool.key]!.success ? "text-green-400" : "text-red-400"}`}>
                      {results[tool.key]!.duration}ms
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{tool.description}</p>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(tool.args).map(([key, argDef]) => {
                  if (key === "url") return null;
                  const val = (args[tool.key]?.[key]) || argDef.default || "";
                  return (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-0.5">
                        {argDef.label}
                        {argDef.optional && <span className="text-gray-700 ml-1">(opt)</span>}
                      </label>
                      {argDef.type === "boolean" ? (
                        <select
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                          value={val}
                          onChange={(e) => setToolArg(tool.key, key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      ) : argDef.type === "select" ? (
                        <select
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                          value={val}
                          onChange={(e) => setToolArg(tool.key, key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {key === "detail" && <><option value="basic">basic</option><option value="full">full</option></>}
                          {key === "wcagLevel" && <><option value="aa">AA</option><option value="aaa">AAA</option></>}
                          {key === "checks" && <><option value="all">all</option><option value="scan">scan</option><option value="a11y">a11y</option></>}
                        </select>
                      ) : (
                        <input
                          type={argDef.type}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                          placeholder={argDef.placeholder}
                          value={val}
                          onChange={(e) => setToolArg(tool.key, key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={(e) => { e.stopPropagation(); executeTool(tool.key); }}
                  disabled={isRunning || !url}
                  className={`w-full mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isRunning
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : tool.key === "test_components"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isRunning ? "Running..." : `▶ ${tool.key === "test_components" ? "Run All Checks" : "Run"}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeResult && results[activeResult] && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Result: {TOOLS.find((t) => t.key === activeResult)?.label || activeResult}
          </h2>
          <ResultViewer result={results[activeResult]!} />
        </div>
      )}
    </div>
  );
}

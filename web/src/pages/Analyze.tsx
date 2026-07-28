import { useState, useCallback } from "react";
import { api, type ToolResult } from "../api/client.ts";

function tryFormatJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

export default function Analyze() {
  const [url, setUrl] = useState("");
  const [checks, setChecks] = useState("all");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.executeTool("analyze_page", { url, checks });
      setResult(res);
    } catch (err) {
      setResult({ success: false, duration: 0, content: [], isError: true, error: (err as Error).message });
    }
    setLoading(false);
  }, [url, checks]);

  const renderResult = () => {
    if (!result) return null;
    const text = result.content?.[0]?.text || "{}";
    let data: any;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!data) return <pre className="text-sm font-mono whitespace-pre-wrap">{text}</pre>;

    const scoreColor = data.score >= 80 ? "text-green-400" : data.score >= 50 ? "text-yellow-400" : "text-red-400";

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Score</div>
            <div className={`text-2xl font-bold ${scoreColor}`}>{data.score}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Issues</div>
            <div className="text-2xl font-bold">{data.totalIssues}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Critical</div>
            <div className="text-2xl font-bold text-red-400">{data.criticalCount || 0}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Warnings</div>
            <div className="text-2xl font-bold text-yellow-400">{data.warningCount || 0}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Info</div>
            <div className="text-2xl font-bold text-blue-400">{data.infoCount || 0}</div>
          </div>
        </div>

        {data.issues?.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-400 uppercase">Issues</h3>
            {data.issues.map((issue: any, i: number) => (
              <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${issue.severity === "critical" ? "bg-red-500" : issue.severity === "warning" ? "bg-yellow-500" : "bg-blue-500"}`} />
                  <span className="font-medium">{issue.message}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${issue.severity === "critical" ? "bg-red-900/50 text-red-400" : issue.severity === "warning" ? "bg-yellow-900/50 text-yellow-400" : "bg-blue-900/50 text-blue-400"}`}>{issue.severity}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-4">{issue.howToFix}</p>
              </div>
            ))}
          </div>
        )}

        {data.recommendations?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Recommendations</h3>
            <ul className="space-y-1">
              {data.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm bg-gray-800 rounded px-3 py-2 text-gray-300">◆ {r}</li>
              ))}
            </ul>
          </div>
        )}

        {data.metrics?.performance && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(data.metrics.performance).map(([key, val]) => (
                <div key={key} className="bg-gray-800 rounded px-2 py-1 text-xs">
                  <span className="text-gray-500">{key}:</span> <span className="text-gray-300">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => { const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `analyze-${Date.now()}.json`; a.click(); }} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors">Export JSON</button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Single Page Analysis</h1>
        <p className="text-sm text-gray-600 mt-0.5">Deep audit of one page: 25 SEO issues with howToFix, performance metrics, security checks</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex gap-3">
        <input type="url" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="https://exemplo.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" value={checks} onChange={(e) => setChecks(e.target.value)}>
          <option value="all">All checks</option>
          <option value="seo">SEO only</option>
          <option value="seo,perf">SEO + Perf</option>
          <option value="seo,security">SEO + Security</option>
        </select>
        <button onClick={run} disabled={loading || !url} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${loading || !url ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>{loading ? "Analyzing..." : "▶ Analyze"}</button>
      </div>

      {loading && <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500"><div className="animate-pulse">Analyzing page...</div></div>}
      {result && !loading && <div className="bg-gray-900 rounded-xl border border-gray-800 p-4"><div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800"><span className={`w-2 h-2 rounded-full ${result.success ? "bg-green-500" : "bg-red-500"}`} /><span className="text-sm font-medium">{result.success ? "Analysis Complete" : "Failed"}</span><span className="text-xs text-gray-500 ml-auto">{result.duration}ms</span></div>{renderResult()}</div>}
    </div>
  );
}

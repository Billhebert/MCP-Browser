import { useState, useCallback, useRef } from "react";
import { api, type ToolResult } from "../api/client.ts";

const EXAMPLE_CONTRACT = JSON.stringify({
  name: "Exemplo: Página de login",
  url: "https://example.com/login",
  actions: [
    { type: "fill", selector: "#email", value: "teste@email.com" },
    { type: "click", selector: "#submit" },
    { type: "wait", ms: 1500 }
  ],
  assert: {
    selectors: [
      { name: "Título", selector: "h1", expected: "Login" },
      { name: "Erro visível", selector: ".error", check: "visible" },
      { name: "Botão submit", selector: "#submit", check: "exists" }
    ],
    console: { errors: 0 },
    performance: { lcp: { max: 2500 }, cls: { max: 0.1 } }
  }
}, null, 2);

export default function Contracts() {
  const [json, setJson] = useState(EXAMPLE_CONTRACT);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ name: string; score: number; passed: number; total: number; time: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.executeTool("test_contract", { contract: json });
      setResult(res);
      const text = res.content?.[0]?.text || "{}";
      const data = JSON.parse(text);
      setHistory((h) => [{ name: data.contract, score: data.score, passed: data.passed, total: data.total, time: new Date().toLocaleTimeString() }, ...h].slice(0, 20));
    } catch (err) {
      setResult({ success: false, duration: 0, content: [], isError: true, error: (err as Error).message });
    }
    setLoading(false);
  }, [json]);

  const loadFile = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJson(reader.result as string);
    reader.readAsText(file);
  }, []);

  const renderResult = () => {
    if (!result) return null;
    const text = result.content?.[0]?.text || "{}";
    let data: any;
    try { data = JSON.parse(text); } catch { return <pre className="text-sm font-mono whitespace-pre-wrap">{text}</pre>; }

    return (
      <div className="space-y-3">
        <div className={`text-lg font-bold ${data.status === "passed" ? "text-green-400" : "text-red-400"}`}>
          {data.status === "passed" ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-800 rounded-lg p-2 text-center"><div className="text-xs text-gray-500">Score</div><div className="text-xl font-bold">{data.score}</div></div>
          <div className="bg-gray-800 rounded-lg p-2 text-center"><div className="text-xs text-gray-500">Passed</div><div className="text-xl font-bold text-green-400">{data.passed}</div></div>
          <div className="bg-gray-800 rounded-lg p-2 text-center"><div className="text-xs text-gray-500">Failed</div><div className="text-xl font-bold text-red-400">{data.failed}</div></div>
          <div className="bg-gray-800 rounded-lg p-2 text-center"><div className="text-xs text-gray-500">Total</div><div className="text-xl font-bold">{data.total}</div></div>
        </div>
        {data.results?.length > 0 && (
          <div className="space-y-1">
            {data.results.map((r: any, i: number) => (
              <div key={i} className={`flex items-center justify-between text-sm rounded px-3 py-2 ${r.status === "pass" ? "bg-green-900/20" : "bg-red-900/20"}`}>
                <div className="flex items-center gap-2">
                  <span>{r.status === "pass" ? "✅" : "❌"}</span>
                  <span className="font-medium">{r.name}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {r.actual !== undefined && <span>actual: {JSON.stringify(r.actual)}</span>}
                  {r.expected !== undefined && <span className="ml-2">expected: {JSON.stringify(r.expected)}</span>}
                  {r.error && <span className="text-red-400">{r.error}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Contract Testing</h1>
        <p className="text-sm text-gray-600 mt-0.5">Define a JSON contract before development and validate after. Supports: selectors, APIs, performance, console, audits, cookies.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Contract JSON</h3>
              <div className="flex gap-2">
                <button onClick={() => setJson(EXAMPLE_CONTRACT)} className="text-xs text-gray-500 hover:text-white">Reset example</button>
                <button onClick={loadFile} className="text-xs text-gray-500 hover:text-white">Load file</button>
                <input ref={fileRef} type="file" accept=".json,.contract.json" className="hidden" onChange={handleFile} />
              </div>
            </div>
            <textarea className="w-full h-[400px] bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-blue-500 resize-none" value={json} onChange={(e) => setJson(e.target.value)} />
          </div>
          <button onClick={run} disabled={loading} className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${loading ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>{loading ? "Running..." : "▶ Execute Contract"}</button>
        </div>

        <div className="space-y-3">
          {result && !loading && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-auto max-h-[500px]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
                <span className={`text-sm font-medium ${result.success ? "text-green-400" : "text-red-400"}`}>{result.success ? "Executed" : "Error"}</span>
                <span className="text-xs text-gray-500">{result.duration}ms</span>
              </div>
              {renderResult()}
            </div>
          )}
          {loading && <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500"><div className="animate-pulse">Executing contract...</div></div>}

          {history.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">History</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1">
                    <span className="truncate flex-1">{h.name}</span>
                    <span className={`font-bold mx-2 ${h.score >= 80 ? "text-green-400" : "text-red-400"}`}>{h.score}</span>
                    <span className="text-gray-500">{h.passed}/{h.total}</span>
                    <span className="text-gray-600 ml-2">{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

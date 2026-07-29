import { useEffect, useState } from "react";

interface Snapshot {
  name: string;
  created_at: string;
}

export default function AuditComparison() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [dataA, setDataA] = useState<any>(null);
  const [dataB, setDataB] = useState<any>(null);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((data) => setSnapshots(data.snapshots || []))
      .catch(console.error);
  }, []);

  const loadBoth = async () => {
    if (!a || !b) return;
    const [ra, rb] = await Promise.all([
      fetch(`/api/snapshots/${a}`).then((r) => r.json()),
      fetch(`/api/snapshots/${b}`).then((r) => r.json()),
    ]);
    setDataA(ra.data || ra);
    setDataB(rb.data || rb);
  };

  const diff = (vA: number, vB: number) => {
    const d = vB - vA;
    if (d === 0) return <span className="text-gray-500">0</span>;
    return <span className={d > 0 ? "text-green-400" : "text-red-400"}>{d > 0 ? "+" : ""}{d}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Audit Comparison</h1>
        <p className="text-sm text-gray-600 mt-0.5">Side-by-side comparison of two audit snapshots</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Baseline</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={a}
            onChange={(e) => setA(e.target.value)}
          >
            <option value="">— Select —</option>
            {snapshots.map((s) => (
              <option key={s.name} value={s.name}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Current</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            value={b}
            onChange={(e) => setB(e.target.value)}
          >
            <option value="">— Select —</option>
            {snapshots.map((s) => (
              <option key={s.name} value={s.name}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>
            ))}
          </select>
        </div>
        <button
          onClick={loadBoth}
          disabled={!a || !b}
          className="md:col-span-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          Compare
        </button>
      </div>

      {dataA && dataB && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          <h2 className="font-semibold">Score Comparison</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Overall Score</div>
              <div className="text-xl font-bold">{dataA.site?.overallScore ?? "—"}</div>
              <div className="text-xs text-gray-500">Baseline</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500">Overall Score</div>
              <div className="text-xl font-bold">{dataB.site?.overallScore ?? "—"}</div>
              <div className="text-xs text-gray-500">Current</div>
            </div>
            <div className={`bg-gray-800 rounded-lg p-3 text-center`}>
              <div className="text-xs text-gray-500">Diff</div>
              <div className="text-xl font-bold">
                {diff(dataA.site?.overallScore ?? 0, dataB.site?.overallScore ?? 0)}
              </div>
              <div className={`text-xs ${(dataB.site?.overallScore ?? 0) >= (dataA.site?.overallScore ?? 0) ? "text-green-500" : "text-red-500"}`}>
                {(dataB.site?.overallScore ?? 0) >= (dataA.site?.overallScore ?? 0) ? "Improved" : "Regressed"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <h3 className="text-xs text-gray-500 uppercase mb-2">Baseline Pages</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {dataA.perPage?.slice(0, 10).map((p: any) => (
                  <div key={p.url} className="flex justify-between text-xs bg-gray-800 rounded px-2 py-1">
                    <span className="truncate">{p.url}</span>
                    <span className="font-bold ml-2">{p.overallScore}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-gray-500 uppercase mb-2">Current Pages</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {dataB.perPage?.slice(0, 10).map((p: any) => (
                  <div key={p.url} className="flex justify-between text-xs bg-gray-800 rounded px-2 py-1">
                    <span className="truncate">{p.url}</span>
                    <span className="font-bold ml-2">{p.overallScore}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {dataA.recommendations?.length > 0 && dataB.recommendations?.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 uppercase mb-2">Recommendations Changed</h3>
              <div className="text-xs text-gray-500">
                Baseline: {dataA.recommendations.length} · Current: {dataB.recommendations.length}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

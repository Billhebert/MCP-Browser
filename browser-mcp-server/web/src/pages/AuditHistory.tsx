import { useEffect, useState } from "react";

interface Snapshot {
  name: string;
  created_at: string;
  tags: string[];
}

export default function AuditHistory() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapData, setSnapData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((data) => setSnapshots(data.snapshots || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadSnapshot = async (name: string) => {
    setSelected(name);
    try {
      const res = await fetch(`/api/snapshots/${name}`);
      const data = await res.json();
      setSnapData(data.data || data);
    } catch { setSnapData(null); }
  };

  const deleteSnapshot = async (name: string) => {
    await fetch(`/api/snapshots/${name}`, { method: "DELETE" });
    setSnapshots((s) => s.filter((x) => x.name !== name));
    if (selected === name) { setSelected(null); setSnapData(null); }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Audit History</h1>
        <p className="text-sm text-gray-600 mt-0.5">Previously saved full site audit results</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : snapshots.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
          No saved audits yet. Run a full site audit and save it to see it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-1">
            {snapshots.map((s) => (
              <div
                key={s.name}
                className={`bg-gray-900 rounded-lg border px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors ${
                  selected === s.name ? "border-blue-500" : "border-gray-800"
                }`}
                onClick={() => loadSnapshot(s.name)}
              >
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</div>
                {s.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {s.tags.map((t) => (
                      <span key={t} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            {snapData ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{selected}</h2>
                  <button onClick={() => deleteSnapshot(selected!)} className="text-xs text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </div>
                {snapData.site && (
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Score</div>
                      <div className="text-lg font-bold">{snapData.site.overallScore}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Pages</div>
                      <div className="text-lg font-bold">{snapData.site.successfulPages}/{snapData.site.totalPages}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Issues</div>
                      <div className="text-lg font-bold">{snapData.site.totalIssuesFound}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">URL</div>
                      <div className="text-xs truncate">{snapData.site.url}</div>
                    </div>
                  </div>
                )}
                {snapData.perPage && (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {snapData.perPage.slice(0, 20).map((p: any) => (
                      <div key={p.url} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1">
                        <span className="truncate flex-1">{p.url}</span>
                        <span className="ml-2 font-bold">{p.overallScore}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selected ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
                Loading...
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
                Select an audit to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api, type AuditEntry } from "../api/client.ts";

export default function History() {
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.getAudits().then((list) => {
      setAudits(list.reverse());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = filter ? audits.filter((a) => a.tool.toLowerCase().includes(filter.toLowerCase()) || a.user.toLowerCase().includes(filter.toLowerCase())) : audits;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Execution History</h1>
        <p className="text-sm text-gray-600 mt-0.5">Last {audits.length} tool executions</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-3">
        <input
          type="text"
          placeholder="Filter by tool or user..."
          className="w-full bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder-gray-600"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-600 py-12 animate-pulse">Loading history...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-12 text-center">
          <div className="text-3xl mb-3">📜</div>
          <p className="text-sm text-gray-600">{audits.length === 0 ? "No execution history yet. Run some tools first!" : "No matches found."}</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50 bg-gray-800/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tool</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Issues</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/30">
                {filtered.map((entry, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-200">{entry.tool}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{entry.user}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${entry.result.status === "pass" ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>{entry.result.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-300">{entry.result.score ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">{entry.result.issueCount ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600">{entry.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-800/50 text-xs text-gray-600">
            {filtered.length} of {audits.length} entries
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";

interface Session {
  id: string; label: string; status: string; createdAt: number; lastActivity: number;
  isCurrent: boolean; url: string | null; consoleLogCount: number; networkLogCount: number;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState("default");
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
      setCurrent(data.current);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const createSession = useCallback(async () => {
    if (!newLabel.trim()) return;
    try {
      await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newLabel.trim() }) });
      setNewLabel("");
      await fetchSessions();
    } catch {}
  }, [newLabel, fetchSessions]);

  const switchSession = useCallback(async (id: string) => {
    await fetch(`/api/sessions/${id}/switch`, { method: "POST" });
    await fetchSessions();
  }, [fetchSessions]);

  const closeSession = useCallback(async (id: string) => {
    await fetch(`/api/sessions/${id}/close`, { method: "POST" });
    await fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Session Manager</h1>
        <p className="text-sm text-gray-600 mt-0.5">Manage multiple isolated browser sessions</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4 flex gap-3">
        <input type="text" placeholder="New session label..." className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 placeholder-gray-600" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createSession()} />
        <button onClick={createSession} disabled={!newLabel.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-medium transition-all active:scale-[0.98]">+ Create</button>
      </div>

      {loading ? (
        <div className="text-center text-gray-600 py-12 animate-pulse">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-12 text-center">
          <div className="text-3xl mb-3">🖥️</div>
          <p className="text-sm text-gray-600">No active sessions. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className={`bg-gray-900 rounded-xl border p-4 flex items-center justify-between transition-all ${s.isCurrent ? "border-blue-500/50 ring-1 ring-blue-500/20" : "border-gray-800/50 hover:border-gray-700/50"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.status === "active" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-red-500"}`} />
                  <span className="font-medium text-gray-200">{s.label}</span>
                  {s.isCurrent && <span className="text-[10px] bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded font-medium">current</span>}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <span className="font-mono text-gray-700">{s.id.slice(0, 20)}...</span>
                  <span className="mx-2">·</span>
                  <span>Created {timeAgo(s.createdAt)} ago</span>
                  {s.url && <><span className="mx-2">·</span><span className="text-gray-500">{s.url}</span></>}
                </div>
                <div className="text-xs text-gray-700 mt-0.5">{s.consoleLogCount} console logs · {s.networkLogCount} network requests</div>
              </div>
              <div className="flex gap-2 ml-4">
                {!s.isCurrent && s.status === "active" && <button onClick={() => switchSession(s.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors">Switch</button>}
                <button onClick={() => closeSession(s.id)} className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs font-medium transition-colors">Close</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

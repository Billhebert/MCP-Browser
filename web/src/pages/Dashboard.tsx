import { useEffect, useState, useCallback } from "react";
import { api, type ToolInfo } from "../api/client.ts";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface StatCard {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: string;
  trend?: "up" | "down" | "neutral";
}

export default function Dashboard() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [auditStats, setAuditStats] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  const refresh = useCallback(() => {
    api.listTools().then(setTools).catch(() => {});
    api.getHealth().then(setHealth).catch(() => {});
    api.getStats().then(setStats).catch(() => {});
    fetch("/api/audits/stats").then((r) => r.json()).then(setAuditStats).catch(() => {});
    fetch("/api/snapshots").then((r) => r.json()).then((d) => setSnapshots(d.snapshots || [])).catch(() => {});
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);

  const cards: StatCard[] = [
    { label: "Tools", value: tools.length, sub: "ready to use", color: "from-blue-500 to-cyan-500", icon: "🔧", trend: "neutral" },
    { label: "Server", value: health?.status === "ok" ? "Online" : "Offline", sub: `v${stats?.version || "1.0.0"}`, color: health?.status === "ok" ? "from-green-500 to-emerald-500" : "from-red-500 to-orange-500", icon: "🌐", trend: health?.status === "ok" ? "up" : "down" },
    { label: "Audits", value: auditStats?.total || 0, sub: auditStats?.errors ? `${auditStats.errors} errors` : "no errors", color: "from-purple-500 to-pink-500", icon: "📊", trend: auditStats?.errors ? "down" : "up" },
    { label: "Snapshots", value: snapshots.length, sub: snapshots.length > 0 ? `last ${timeAgo(new Date(snapshots[0].created_at).getTime())} ago` : "none saved", color: "from-orange-500 to-yellow-500", icon: "💾", trend: "neutral" },
  ];

  const categories = [
    { name: "Navigation", color: "bg-blue-500", icon: "🧭" },
    { name: "Interaction", color: "bg-green-500", icon: "🖱️" },
    { name: "Extraction", color: "bg-purple-500", icon: "📥" },
    { name: "Audit", color: "bg-orange-500", icon: "🔍" },
    { name: "Performance", color: "bg-yellow-500", icon: "⚡" },
    { name: "Testing", color: "bg-pink-500", icon: "🧪" },
    { name: "Security", color: "bg-red-500", icon: "🛡️" },
    { name: "Data", color: "bg-cyan-500", icon: "🗄️" },
    { name: "Dev/UI", color: "bg-indigo-500", icon: "🎨" },
    { name: "Storybook", color: "bg-fuchsia-500", icon: "📚" },
    { name: "Corporate", color: "bg-teal-500", icon: "🏢" },
  ];

  const catCounts: Record<string, number> = {};
  for (const t of tools) {
    const d = t.description.toLowerCase();
    let cat = "Other";
    if (d.includes("navigate") || d.includes("go_back") || d.includes("refresh") || d.includes("tab") || d.includes("wait")) cat = "Navigation";
    else if (d.includes("click") || d.includes("fill") || d.includes("select") || d.includes("hover") || d.includes("press") || d.includes("scroll") || d.includes("drag") || d.includes("upload")) cat = "Interaction";
    else if (d.includes("text") || d.includes("html") || d.includes("attribute") || d.includes("find") || d.includes("form") || d.includes("table") || d.includes("cookie") || d.includes("screenshot") || d.includes("extract") || d.includes("export")) cat = "Extraction";
    else if (d.includes("seo") || d.includes("a11y") || d.includes("contrast") || d.includes("image") || d.includes("cache") || d.includes("link") || d.includes("spelling") || d.includes("redirect") || d.includes("validate") || d.includes("json-ld") || d.includes("typography") || d.includes("privacy") || d.includes("consent") || d.includes("third") || d.includes("readability") || d.includes("audit") || d.includes("full_site") || d.includes("analyze_")) cat = "Audit";
    else if (d.includes("perf") || d.includes("lighthouse") || d.includes("budget") || d.includes("waterfall") || d.includes("bundle") || d.includes("deps") || d.includes("css") || d.includes("mark")) cat = "Performance";
    else if (d.includes("test_") || d.includes("fuzz") || d.includes("smoke") || d.includes("flow") || d.includes("api") || d.includes("load") || d.includes("diff") || d.includes("mock")) cat = "Testing";
    else if (d.includes("security") || d.includes("owasp") || d.includes("cve") || d.includes("endpoint") || d.includes("ssl")) cat = "Security";
    else if (d.includes("scrape") || d.includes("csv") || d.includes("sitemap") || d.includes("sql")) cat = "Data";
    else if (d.includes("component") || d.includes("design") || d.includes("responsive") || d.includes("ui_")) cat = "Dev/UI";
    else if (d.includes("storybook")) cat = "Storybook";
    else if (d.includes("health") || d.includes("suite") || d.includes("ci") || d.includes("note") || d.includes("schedule") || d.includes("report") || d.includes("webhook") || d.includes("slack") || d.includes("jira") || d.includes("compare") || d.includes("discord") || d.includes("session") || d.includes("plugin")) cat = "Corporate";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">BVP Browser MCP Server</p>
        </div>
        <button onClick={refresh} className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700">
          ↻ Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="group relative bg-gray-900 rounded-xl border border-gray-800/50 p-4 overflow-hidden hover:border-gray-700/50 transition-all duration-200">
            <div className={`absolute inset-0 opacity-[0.03] bg-gradient-to-br ${card.color}`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{card.icon}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${card.trend === "up" ? "bg-green-900/50 text-green-400" : card.trend === "down" ? "bg-red-900/50 text-red-400" : "bg-gray-800 text-gray-500"}`}>
                  {card.trend === "up" ? "▲" : card.trend === "down" ? "▼" : "—"}
                </span>
              </div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tools by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {categories.filter((c) => catCounts[c.name]).map((cat) => (
            <div key={cat.name} className="bg-gray-800/40 rounded-lg p-3 flex items-center gap-2.5 hover:bg-gray-800/80 transition-colors">
              <span className="text-sm">{cat.icon}</span>
              <div>
                <div className="text-xs text-gray-400">{cat.name}</div>
                <div className="text-lg font-bold">{catCounts[cat.name]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { href: "/playground", label: "Playground", icon: "🔧", color: "bg-blue-600 hover:bg-blue-700" },
            { href: "/audits", label: "Full Audit", icon: "🌐", color: "bg-orange-600 hover:bg-orange-700" },
            { href: "/analyze", label: "Analyze Page", icon: "🔬", color: "bg-cyan-600 hover:bg-cyan-700" },
            { href: "/contracts", label: "Contracts", icon: "📋", color: "bg-indigo-600 hover:bg-indigo-700" },
            { href: "/storybook", label: "Storybook", icon: "📚", color: "bg-fuchsia-600 hover:bg-fuchsia-700" },
            { href: "/sql", label: "SQL Console", icon: "🗄️", color: "bg-emerald-600 hover:bg-emerald-700" },
          ].map((btn) => (
            <a key={btn.href} href={btn.href} className={`${btn.color} rounded-lg p-3 text-center text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]`}>
              <div className="text-base mb-0.5">{btn.icon}</div>
              {btn.label}
            </a>
          ))}
        </div>
      </div>

      {auditStats?.topTools?.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Most Used Tools</h2>
          <div className="space-y-1">
            {auditStats.topTools.slice(0, 8).map((t: any) => {
              const max = auditStats.topTools[0]?.count || 1;
              const pct = Math.round((t.count / max) * 100);
              return (
                <div key={t.tool} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate text-gray-300">{t.tool}</span>
                  <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 text-right text-gray-500">{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Snapshots</h2>
          <div className="flex flex-wrap gap-2">
            {snapshots.slice(0, 6).map((s: any) => (
              <div key={s.name} className="bg-gray-800/40 rounded-lg px-3 py-2 text-xs">
                <div className="text-gray-300">{s.name}</div>
                <div className="text-gray-600 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

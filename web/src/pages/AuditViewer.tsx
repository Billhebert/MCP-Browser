import { useState, useMemo } from "react";
import { useAuditStream } from "../hooks/useAuditStream.ts";
import ScanProgressBar from "../components/audit/ScanProgressBar.tsx";
import SiteSummaryCards from "../components/audit/SiteSummaryCards.tsx";
import CategoryScoreGrid from "../components/audit/CategoryScoreGrid.tsx";
import PageResultsTable from "../components/audit/PageResultsTable.tsx";
import PatternsPanel from "../components/audit/PatternsPanel.tsx";
import RecommendationsPanel from "../components/audit/RecommendationsPanel.tsx";
import ScoreDistributionChart from "../components/audit/ScoreDistributionChart.tsx";

export default function AuditViewer() {
  const { state, startScan, reset } = useAuditStream();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("5");
  const [depth, setDepth] = useState("1");
  const [categories, setCategories] = useState("all");
  const [concurrency, setConcurrency] = useState("2");
  const [showConfig, setShowConfig] = useState(false);

  const pages = useMemo(() => {
    return Array.from(state.pages.values()).map((p) => ({
      url: p.url,
      title: p.title,
      status: p.status,
      overallScore: p.score ?? 0,
      categoryScores: {},
      totalIssues: p.issueCount,
      toolResults: [],
    }));
  }, [state.pages]);

  const isRunning = state.status === "running";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Full Site Audit</h1>
          <p className="text-sm text-gray-600 mt-0.5">Crawl and audit all pages — Unlighthouse-style dashboard with live streaming</p>
        </div>
        {state.status !== "idle" && (
          <button onClick={reset} className="text-sm text-gray-500 hover:text-white transition-colors">
            Reset
          </button>
        )}
      </div>

      {state.status === "idle" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <input
              type="url"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && url && startScan(url, { maxPages: parseInt(maxPages), maxDepth: parseInt(depth), categories, concurrency: parseInt(concurrency) })}
            />
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className="text-xs text-gray-500 hover:text-white">
            {showConfig ? "Hide" : "Show"} advanced options
          </button>
          {showConfig && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Max Pages</label>
                <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} min={1} max={50} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Max Depth</label>
                <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" value={depth} onChange={(e) => setDepth(e.target.value)} min={1} max={5} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Concurrency</label>
                <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} min={1} max={10} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Categories</label>
                <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" placeholder='all or "seo,a11y,perf"' value={categories} onChange={(e) => setCategories(e.target.value)} />
              </div>
            </div>
          )}
          <button
            onClick={() => startScan(url, { maxPages: parseInt(maxPages), maxDepth: parseInt(depth), categories, concurrency: parseInt(concurrency) })}
            disabled={!url}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            ▶ Run Full Site Audit
          </button>
        </div>
      )}

      {isRunning && (
        <ScanProgressBar
          completed={state.progress.completed}
          total={state.progress.total}
          phase={state.phase}
          message={state.message}
        />
      )}

      {state.status === "error" && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {state.error}
        </div>
      )}

      {state.dashboard && (
        <>
          <SiteSummaryCards
            overallScore={state.dashboard.site.overallScore}
            totalPages={state.dashboard.site.totalPages}
            successfulPages={state.dashboard.site.successfulPages}
            totalIssuesFound={state.dashboard.site.totalIssuesFound}
            scanDurationMs={state.dashboard.site.scanDurationMs}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryScoreGrid categories={state.dashboard.categories} />
            <ScoreDistributionChart
              scores={state.dashboard.perPage.map((p) => p.overallScore)}
            />
          </div>

          <PageResultsTable pages={state.dashboard.perPage} />

          <PatternsPanel patterns={state.dashboard.patterns} />

          <RecommendationsPanel recommendations={state.dashboard.recommendations} />

          <div className="flex gap-2">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(state.dashboard, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `audit-${Date.now()}.json`;
                a.click();
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors"
            >
              Export JSON
            </button>
          </div>
        </>
      )}

      {isRunning && state.progress.completed > 0 && state.progress.total === 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-500">
          <div className="animate-pulse">Discovering URLs...</div>
        </div>
      )}
    </div>
  );
}

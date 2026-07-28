import { useState, useMemo } from "react";
import PageRow from "./PageRow.tsx";

interface PageResultsTableProps {
  pages: Array<{
    url: string;
    title: string;
    status: string;
    overallScore: number;
    categoryScores: Record<string, number>;
    totalIssues: number;
    toolResults: Array<{
      tool: string;
      category: string;
      status: string;
      score: number | null;
      issueCount: number;
      duration: number;
    }>;
  }>;
}

type SortKey = "url" | "score" | "issues";

export default function PageResultsTable({ pages }: PageResultsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);

  const categoryKeys = pages.length > 0 ? Object.keys(pages[0].categoryScores) : [];

  const filtered = useMemo(() => {
    return pages
      .filter((p) => {
        const matchesSearch = !search || p.url.toLowerCase().includes(search.toLowerCase()) || p.title.toLowerCase().includes(search.toLowerCase());
        const matchesScore = p.overallScore >= minScore && p.overallScore <= maxScore;
        return matchesSearch && matchesScore;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "url") cmp = a.url.localeCompare(b.url);
        else if (sortKey === "score") cmp = a.overallScore - b.overallScore;
        else if (sortKey === "issues") cmp = a.totalIssues - b.totalIssues;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [pages, search, sortKey, sortDir, minScore, maxScore]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search URL or title..."
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Score:</span>
          <input type="range" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-20" />
          <span>{minScore}–{maxScore}</span>
          <input type="range" min={0} max={100} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="w-20" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-3 py-2 text-left cursor-pointer hover:text-white" onClick={() => toggleSort("url")}>
                URL{arrow("url")}
              </th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-center cursor-pointer hover:text-white" onClick={() => toggleSort("score")}>
                Score{arrow("score")}
              </th>
              {categoryKeys.map((key) => (
                <th key={key} className="px-2 py-2 text-center text-xs capitalize">{key}</th>
              ))}
              <th className="px-3 py-2 text-center cursor-pointer hover:text-white" onClick={() => toggleSort("issues")}>
                Issues{arrow("issues")}
              </th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((page) => (
              <PageRow key={page.url} {...page} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-2 border-t border-gray-800 text-xs text-gray-600 text-center">
        {filtered.length} of {pages.length} pages
      </div>
    </div>
  );
}

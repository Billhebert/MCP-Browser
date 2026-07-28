import { useState } from "react";
import ScoreCell from "./ScoreCell.tsx";

interface PageRowProps {
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
}

export default function PageRow({ url, title, status, overallScore, categoryScores, totalIssues, toolResults }: PageRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2 text-xs font-mono truncate max-w-[200px]" title={url}>
          {url.replace(/^https?:\/\//, "").slice(0, 60)}
        </td>
        <td className="px-3 py-2 text-xs text-gray-400 truncate max-w-[150px]" title={title}>
          {title || "—"}
        </td>
        <td className="px-3 py-2 text-center">
          <ScoreCell score={overallScore} />
        </td>
        {Object.entries(categoryScores).map(([key, sc]) => (
          <td key={key} className="px-2 py-2 text-center">
            <ScoreCell score={sc} />
          </td>
        ))}
        <td className="px-3 py-2 text-center text-xs text-gray-500">
          {totalIssues}
        </td>
        <td className="px-3 py-2 text-center text-xs text-gray-500">
          <span className={`inline-block w-2 h-2 rounded-full ${status === "success" ? "bg-green-500" : "bg-red-500"}`} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-900/50">
          <td colSpan={6 + Object.keys(categoryScores).length} className="p-3">
            <div className="text-xs space-y-1">
              {toolResults.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-400">
                  <span className="font-medium text-gray-300 w-32">{t.tool}</span>
                  <ScoreCell score={t.score} />
                  <span className="text-gray-600">{t.duration}ms</span>
                  <span className="text-gray-600">{t.issueCount} issues</span>
                  <span className={`text-xs ${t.status === "pass" ? "text-green-500" : "text-red-500"}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

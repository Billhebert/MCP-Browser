interface Pattern {
  type: string;
  category: string;
  severity: string;
  message: string;
  affectedCount: number;
  totalPages: number;
  percentage: number;
}

interface PatternsPanelProps {
  patterns: Pattern[];
}

export default function PatternsPanel({ patterns }: PatternsPanelProps) {
  if (patterns.length === 0) return null;

  const severityColor = (sev: string) =>
    sev === "high" ? "bg-red-900/50 text-red-400"
    : sev === "medium" ? "bg-yellow-900/50 text-yellow-400"
    : sev === "info" ? "bg-blue-900/50 text-blue-400"
    : "bg-gray-800 text-gray-400";

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
        Cross-Page Patterns ({patterns.length})
      </h3>
      <div className="space-y-2">
        {patterns.slice(0, 20).map((p, i) => (
          <div key={i} className="flex items-center gap-3 text-sm bg-gray-950 rounded-lg px-3 py-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${severityColor(p.severity)}`}>
              {p.severity}
            </span>
            <span className="flex-1 text-gray-300">{p.message}</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${p.percentage > 50 ? "bg-red-500" : p.percentage > 20 ? "bg-yellow-500" : "bg-blue-500"}`}
                  style={{ width: `${p.percentage}%` }}
                />
              </div>
              <span>{p.affectedCount}/{p.totalPages}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

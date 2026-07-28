interface ScanProgressBarProps {
  completed: number;
  total: number;
  phase: string;
  message: string;
}

export default function ScanProgressBar({ completed, total, phase, message }: ScanProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const phaseColors: Record<string, string> = {
    discovering: "bg-blue-500",
    scanning: "bg-green-500",
    analyzing: "bg-purple-500",
    complete: "bg-green-600",
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {phase !== "complete" && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-gray-300">{message || phase}</span>
        </div>
        <div className="text-xs text-gray-500">
          {completed}/{total} pages · {pct}%
        </div>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${phaseColors[phase] || "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {phase === "scanning" && completed > 0 && (
        <div className="text-xs text-gray-600">
          Last: scanning pages...
        </div>
      )}
    </div>
  );
}

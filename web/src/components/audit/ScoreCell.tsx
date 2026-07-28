interface ScoreCellProps {
  score: number | null;
  showValue?: boolean;
}

export default function ScoreCell({ score, showValue = true }: ScoreCellProps) {
  if (score === null || score === undefined) {
    return <span className="text-gray-600 text-xs">—</span>;
  }

  const bg = score >= 90 ? "bg-green-900/40 text-green-400"
    : score >= 70 ? "bg-yellow-900/40 text-yellow-400"
    : score >= 50 ? "bg-orange-900/40 text-orange-400"
    : "bg-red-900/40 text-red-400";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg}`}>
      {showValue ? score : ""}
    </span>
  );
}

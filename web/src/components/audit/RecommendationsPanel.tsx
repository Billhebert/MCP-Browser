interface RecommendationsPanelProps {
  recommendations: string[];
}

export default function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Recommendations</h3>
      <ul className="space-y-1">
        {recommendations.map((r, i) => (
          <li key={i} className="text-sm bg-gray-950 rounded-lg px-3 py-2 text-gray-300 flex items-start gap-2">
            <span className="text-yellow-500 mt-0.5">◆</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

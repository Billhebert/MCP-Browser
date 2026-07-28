interface SiteSummaryCardsProps {
  overallScore: number;
  totalPages: number;
  successfulPages: number;
  totalIssuesFound: number;
  scanDurationMs: number;
}

export default function SiteSummaryCards({ overallScore, totalPages, successfulPages, totalIssuesFound, scanDurationMs }: SiteSummaryCardsProps) {
  const cards = [
    { label: "Overall Score", value: overallScore, suffix: "", color: overallScore >= 90 ? "text-green-400" : overallScore >= 70 ? "text-yellow-400" : overallScore >= 50 ? "text-orange-400" : "text-red-400" },
    { label: "Pages", value: `${successfulPages}/${totalPages}`, suffix: "", color: "text-blue-400" },
    { label: "Issues Found", value: totalIssuesFound, suffix: "", color: totalIssuesFound > 0 ? "text-red-400" : "text-green-400" },
    { label: "Duration", value: (scanDurationMs / 1000).toFixed(1), suffix: "s", color: "text-gray-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">{card.label}</div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {card.value}<span className="text-sm text-gray-600 ml-0.5">{card.suffix}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

import MetricGauge from "./MetricGauge.tsx";

interface CategoryScoreGridProps {
  categories: Record<string, {
    averageScore: number;
    passCount: number;
    failCount: number;
  }>;
}

const LABELS: Record<string, string> = {
  seo: "SEO",
  a11y: "A11Y",
  performance: "Perf",
  security: "Security",
  privacy: "Privacy",
  content: "Content",
};

export default function CategoryScoreGrid({ categories }: CategoryScoreGridProps) {
  const entries = Object.entries(categories);
  if (entries.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Categories</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {entries.map(([key, cat]) => (
          <div key={key} className="flex flex-col items-center gap-2">
            <MetricGauge score={cat.averageScore} size={70} strokeWidth={5} />
            <div className="text-xs font-medium">{LABELS[key] || key}</div>
            <div className="text-xs text-gray-600">
              {cat.passCount}p / {cat.failCount}f
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

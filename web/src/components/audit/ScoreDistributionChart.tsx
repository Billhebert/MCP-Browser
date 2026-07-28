import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ScoreDistributionChartProps {
  scores: number[];
}

export default function ScoreDistributionChart({ scores }: ScoreDistributionChartProps) {
  if (scores.length === 0) return null;

  const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const data = buckets.slice(0, -1).map((min, i) => ({
    range: `${min}-${buckets[i + 1]}`,
    count: scores.filter((s) => s >= min && s < buckets[i + 1]).length,
  }));

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
            labelStyle={{ color: "#d1d5db" }}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

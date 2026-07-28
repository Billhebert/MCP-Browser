interface MetricGaugeProps {
  score: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
}

export default function MetricGauge({ score, label, size = 80, strokeWidth = 6 }: MetricGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  const color = score >= 90 ? "#22c55e" : score >= 70 ? "#eab308" : score >= 50 ? "#f97316" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1f2937" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={size * 0.28}
          fontWeight="bold"
          className="rotate-90"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          {score}
        </text>
      </svg>
      {label && <span className="text-xs text-gray-500">{label}</span>}
    </div>
  );
}

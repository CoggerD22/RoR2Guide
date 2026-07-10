import type { SparkPoint } from "@/lib/stacking";

interface SparklineProps {
  points: SparkPoint[];
  width?: number;
  height?: number;
}

/** Tiny value-vs-stack-count line for linear stats (PLAN §2.2). */
export function Sparkline({ points, width = 132, height = 36 }: SparklineProps) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.v);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.v - min) / range) * height;
    return [x, y] as const;
  });

  const d = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label="Value versus stack count"
    >
      <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.7} fill="var(--color-primary)" />
      ))}
    </svg>
  );
}

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

export type MetricPoint = {
  index: number;
  value: number;
};

export function MetricChart({
  points,
  colorVar,
}: {
  points: MetricPoint[];
  colorVar: string;
}) {
  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
        >
          <Tooltip
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: "6px",
              boxShadow: "var(--shadow-sm)",
              background: "var(--surface)",
              fontSize: "11px",
              fontWeight: "600",
            }}
            labelStyle={{ display: "none" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={`var(${colorVar})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import type { ServiceMetric } from "~/hooks/use-flow-state";
import {
  MetricChart,
  type MetricPoint,
} from "~/components/monitor/metric-chart";

export function ServiceCard({
  metric,
  points,
  colorVar,
}: {
  metric: ServiceMetric;
  points: MetricPoint[];
  colorVar: string;
}) {
  return (
    <article className="neo-panel bg-[var(--background)] p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate text-xs font-black uppercase tracking-wide">
          {metric.label}
        </h4>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: `var(${colorVar})` }}
        />
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 font-semibold">
        <p>Ops/s: {metric.opsPerSec.toFixed(1)}</p>
        <p>Queue: {metric.queueDepth}</p>
        <p>Latency: {metric.avgLatencyMs} ms</p>
        <p>Errors: {metric.errorCount}</p>
      </div>

      <div className="mt-1">
        <MetricChart points={points} colorVar={colorVar} />
      </div>
    </article>
  );
}

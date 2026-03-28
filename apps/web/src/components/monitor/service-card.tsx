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
    <article className="card-inset rounded-lg p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate text-xs font-semibold">{metric.label}</h4>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: `var(${colorVar})` }}
        />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
        <p className="text-[var(--muted)]">
          Ops/s{" "}
          <span className="font-medium text-[var(--foreground)]">
            {metric.opsPerSec.toFixed(1)}
          </span>
        </p>
        <p className="text-[var(--muted)]">
          Queue{" "}
          <span className="font-medium text-[var(--foreground)]">
            {metric.queueDepth}
          </span>
        </p>
        <p className="text-[var(--muted)]">
          Latency{" "}
          <span className="font-medium text-[var(--foreground)]">
            {metric.avgLatencyMs} ms
          </span>
        </p>
        <p className="text-[var(--muted)]">
          Errors{" "}
          <span className="font-medium text-[var(--foreground)]">
            {metric.errorCount}
          </span>
        </p>
      </div>

      <div className="mt-1.5">
        <MetricChart points={points} colorVar={colorVar} />
      </div>
    </article>
  );
}

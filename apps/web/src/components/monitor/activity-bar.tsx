import { useMemo } from "react";
import { ServiceCard } from "~/components/monitor/service-card";
import type { ServiceMetric } from "~/hooks/use-flow-state";
import type { ServiceName, SimulationEvent } from "~/lib/event-types";
import type { MetricPoint } from "~/components/monitor/metric-chart";

const serviceColorVarByName: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

function buildSeries(
  events: SimulationEvent[],
  service: ServiceName,
): MetricPoint[] {
  const recent = events.filter((event) => event.source === service).slice(-48);
  const bucketTarget = 12;

  if (recent.length === 0) {
    return Array.from({ length: bucketTarget }, (_, index) => ({
      index: index + 1,
      value: 0,
    }));
  }

  const bucketSize = Math.max(1, Math.ceil(recent.length / bucketTarget));
  const values: number[] = [];

  for (let start = 0; start < recent.length; start += bucketSize) {
    values.push(recent.slice(start, start + bucketSize).length);
  }

  const normalized = values.slice(-bucketTarget);
  while (normalized.length < bucketTarget) {
    normalized.unshift(0);
  }

  return normalized.map((value, index) => ({
    index: index + 1,
    value,
  }));
}

export function ActivityBar({
  metrics,
  events,
}: {
  metrics: ServiceMetric[];
  events: SimulationEvent[];
}) {
  const seriesByService = useMemo(() => {
    const output: Record<ServiceName, MetricPoint[]> = {
      elysia: buildSeries(events, "elysia"),
      redis: buildSeries(events, "redis"),
      bullmq: buildSeries(events, "bullmq"),
      rabbitmq: buildSeries(events, "rabbitmq"),
      kafka: buildSeries(events, "kafka"),
      postgres: buildSeries(events, "postgres"),
    };

    return output;
  }, [events]);

  return (
    <section className="card rounded-xl p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Activity Monitor
      </h3>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <ServiceCard
            key={metric.service}
            metric={metric}
            points={seriesByService[metric.service]}
            colorVar={serviceColorVarByName[metric.service]}
          />
        ))}
      </div>
    </section>
  );
}

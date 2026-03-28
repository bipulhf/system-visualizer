import type { ServiceName } from "~/lib/event-types";
import type { MetricsSnapshot, ServiceResourceMetric } from "~/hooks/use-service-metrics";

const serviceColorVar: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

const serviceLabel: Record<ServiceName, string> = {
  elysia: "Elysia",
  redis: "Redis",
  bullmq: "BullMQ",
  rabbitmq: "RabbitMQ",
  kafka: "Kafka",
  postgres: "Postgres",
};

const memoryLabel: Partial<Record<ServiceName, string>> = {
  postgres: "DB size",
  bullmq: "Shared RSS",
  elysia: "RSS",
};

function CpuBar({
  percent,
  colorVar,
}: {
  percent: number;
  colorVar: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px]">
        <span className="text-[var(--muted)]">CPU</span>
        <span className="font-medium text-[var(--foreground)]">{percent.toFixed(1)}%</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, percent)}%`,
            background: `var(${colorVar})`,
          }}
        />
      </div>
    </div>
  );
}

function ResourceTile({
  service,
  metric,
}: {
  service: ServiceName;
  metric: ServiceResourceMetric;
}) {
  const colorVar = serviceColorVar[service];
  const { cpuPercent, memoryMb, extra } = metric;
  const hasData = cpuPercent !== null || memoryMb !== null;

  return (
    <article className="card-inset rounded-lg p-2.5 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: `var(${colorVar})` }} />
        <span className="font-semibold">{serviceLabel[service]}</span>
        {!hasData ? (
          <span className="ml-auto text-[10px] text-[var(--muted)]">N/A</span>
        ) : null}
      </div>

      {hasData ? (
        <div className="mt-2 space-y-1.5">
          {cpuPercent !== null ? (
            <CpuBar percent={cpuPercent} colorVar={colorVar} />
          ) : null}
          {memoryMb !== null ? (
            <div className="flex justify-between text-[10px]">
              <span className="text-[var(--muted)]">
                {memoryLabel[service] ?? "Memory"}
              </span>
              <span className="font-medium text-[var(--foreground)]">{memoryMb} MB</span>
            </div>
          ) : null}
          {extra ? (
            <p className="text-[10px] text-[var(--muted)]">{extra}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

const services: ServiceName[] = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
];

const emptyMetric: ServiceResourceMetric = {
  cpuPercent: null,
  memoryMb: null,
  extra: null,
};

export function ResourceBar({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  return (
    <section className="card mt-3 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Resource Usage
        </h3>
        <span className="text-[10px] text-[var(--muted)]">
          {snapshot ? "Live · 2s" : "Loading…"}
        </span>
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <ResourceTile
            key={service}
            service={service}
            metric={snapshot?.[service] ?? emptyMetric}
          />
        ))}
      </div>
    </section>
  );
}

import type { ServiceName } from "~/lib/event-types";
import type { TraceResult } from "~/lib/trace-types";

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

const serviceOrder: ServiceName[] = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
];

export function PostMortem({
  result,
  onBackToSteps,
  onRunAnother,
}: {
  result: TraceResult;
  onBackToSteps: () => void;
  onRunAnother: () => void;
}) {
  const { steps, totalLatencyMs } = result;

  // Aggregate latency per service
  const latencyByService: Partial<Record<ServiceName, number>> = {};
  for (const step of steps) {
    const svc = step.source;
    latencyByService[svc] = (latencyByService[svc] ?? 0) + step.latencyMs;
  }

  const orderedServices = serviceOrder
    .filter((s) => (latencyByService[s] ?? 0) > 0)
    .sort((a, b) => (latencyByService[b] ?? 0) - (latencyByService[a] ?? 0));

  const maxLatency = Math.max(
    ...orderedServices.map((s) => latencyByService[s] ?? 0),
  );
  const bottleneck = orderedServices[0];

  const summedMs = orderedServices.reduce(
    (acc, s) => acc + (latencyByService[s] ?? 0),
    0,
  );

  return (
    <div className="card rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Post-Mortem
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {steps.length} steps · {totalLatencyMs}ms total wall time
          </p>
        </div>
        <span className="card-inset min-w-0 max-w-full truncate rounded-md px-2 py-1 text-xs font-mono text-[var(--muted)]">
          {result.requestId}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {orderedServices.map((service) => {
          const ms = latencyByService[service] ?? 0;
          const pct = summedMs > 0 ? Math.round((ms / summedMs) * 100) : 0;
          const barPct = maxLatency > 0 ? (ms / maxLatency) * 100 : 0;
          const isBottleneck = service === bottleneck;

          return (
            <div key={service}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: `var(${serviceColorVar[service]})`,
                    }}
                  />
                  <span className="font-semibold">
                    {serviceLabel[service]}
                  </span>
                  {isBottleneck ? (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      bottleneck
                    </span>
                  ) : null}
                </div>
                <span className="text-[var(--muted)]">
                  <span className="font-semibold text-[var(--foreground)]">
                    {ms}ms
                  </span>{" "}
                  ({pct}%)
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${barPct}%`,
                    background: `var(${serviceColorVar[service]})`,
                    opacity: isBottleneck ? 1 : 0.65,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onBackToSteps}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]"
        >
          ← Back to steps
        </button>
        <button
          onClick={onRunAnother}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--main)] px-3 text-xs font-semibold text-white transition-all hover:brightness-110"
        >
          ▷ Run Another Trace
        </button>
      </div>
    </div>
  );
}

import type { ServiceName } from "~/lib/event-types";
import type { TraceStep } from "~/lib/trace-types";

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

function ServicePill({ service }: { service: ServiceName }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: `color-mix(in oklch, var(${serviceColorVar[service]}) 15%, transparent)`,
        color: `var(${serviceColorVar[service]})`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `var(${serviceColorVar[service]})` }}
      />
      {serviceLabel[service]}
    </span>
  );
}

export function StepCard({
  step,
  stepNumber,
  total,
  onPrev,
  onNext,
}: {
  step: TraceStep;
  stepNumber: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const dataEntries = Object.entries(step.data).filter(
    ([k]) => k !== "requestId",
  );

  return (
    <div className="card rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ServicePill service={step.source} />
          {step.target ? (
            <>
              <span className="text-[var(--muted)]">→</span>
              <ServicePill service={step.target} />
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onPrev}
            disabled={stepNumber === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <span className="min-w-[54px] text-center text-xs font-semibold text-[var(--muted)]">
            {stepNumber} / {total}
          </span>
          <button
            onClick={onNext}
            disabled={stepNumber === total}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="card-inset inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--foreground)]">
              {step.kind}
            </span>
            <p className="mt-1.5 text-sm font-medium text-[var(--foreground)]">
              {step.description}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs text-[var(--muted)]">
            <div>
              <span className="font-semibold text-[var(--foreground)]">
                {step.latencyMs}ms
              </span>{" "}
              this step
            </div>
            <div className="mt-0.5">
              <span className="font-semibold text-[var(--foreground)]">
                {step.cumulativeLatencyMs}ms
              </span>{" "}
              cumulative
            </div>
          </div>
        </div>
      </div>

      {dataEntries.length > 0 ? (
        <div className="card-inset mt-3 rounded-lg p-2.5">
          <dl className="flex flex-wrap gap-x-4 gap-y-1">
            {dataEntries.map(([key, value]) => (
              <div key={key} className="flex min-w-0 items-center gap-1 text-xs">
                <dt className="shrink-0 text-[var(--muted)]">{key}:</dt>
                <dd className="min-w-0 truncate font-medium text-[var(--foreground)]">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {step.learnMore ? (
        <p className="mt-2.5 text-xs text-[var(--muted)]">{step.learnMore}</p>
      ) : null}
    </div>
  );
}

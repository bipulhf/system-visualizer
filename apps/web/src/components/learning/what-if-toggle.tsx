import type { ServiceName } from "~/lib/event-types";
import {
  getScenarioLearningContent,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { useSimulationUi } from "~/lib/simulation-ui-context";
import { cn } from "~/lib/utils";

const serviceOrder: ServiceName[] = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
];

export function WhatIfToggle({
  scenarioId,
}: {
  scenarioId: SupportedScenarioId;
}) {
  const {
    whatIfEnabled,
    setWhatIfEnabled,
    whatIfService,
    setWhatIfService,
    failureCount,
  } = useSimulationUi();
  const scenarioContent = getScenarioLearningContent(scenarioId);
  const whatIfByService = scenarioContent.whatIfByService;
  const current = whatIfByService[whatIfService];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          What If?
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={whatIfEnabled}
          onClick={() => {
            setWhatIfEnabled(!whatIfEnabled);
          }}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            whatIfEnabled
              ? "bg-red-500 text-white"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]",
          )}
        >
          {whatIfEnabled ? "Failure On" : "Enable"}
        </button>
      </div>

      <div className="card-inset space-y-2 rounded-lg p-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Service
        </label>
        <div className="flex flex-wrap gap-1">
          {serviceOrder.map((service) => (
            <button
              key={service}
              type="button"
              aria-pressed={whatIfService === service}
              onClick={() => {
                setWhatIfService(service);
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                whatIfService === service
                  ? "bg-red-500 text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {service}
            </button>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold">{current.failureMode}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {current.explanation}
          </p>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Failure count:{" "}
          <span
            className={cn(
              "font-semibold",
              failureCount > 0 && "text-red-500",
            )}
          >
            {failureCount}
          </span>
        </p>
      </div>
    </section>
  );
}

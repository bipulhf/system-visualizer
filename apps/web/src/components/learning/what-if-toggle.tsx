import type { ServiceName } from "~/lib/event-types";
import {
  getScenarioLearningContent,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { useSimulationUi } from "~/lib/simulation-ui-context";

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
        <h3 className="text-xs font-bold uppercase tracking-wider">What If?</h3>
        <button
          type="button"
          role="switch"
          aria-checked={whatIfEnabled}
          onClick={() => {
            setWhatIfEnabled(!whatIfEnabled);
          }}
          className={`neo-panel h-8 min-w-16 px-2 text-[11px] font-black uppercase ${whatIfEnabled ? "bg-red-500 text-white" : "bg-[var(--surface)]"}`}
        >
          {whatIfEnabled ? "On" : "Off"}
        </button>
      </div>

      <div className="neo-panel bg-[var(--surface)] p-3">
        <label className="text-[11px] font-bold uppercase tracking-wide">
          Service
        </label>
        <div className="mt-1 flex flex-wrap gap-1">
          {serviceOrder.map((service) => (
            <button
              key={service}
              type="button"
              onClick={() => {
                setWhatIfService(service);
              }}
              className={`neo-panel px-2 py-1 text-[11px] font-bold uppercase ${whatIfService === service ? "bg-red-500 text-white" : "bg-[var(--background)]"}`}
            >
              {service}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm font-black">{current.failureMode}</p>
        <p className="mt-1 text-xs leading-relaxed">{current.explanation}</p>

        <p className="mt-2 text-xs font-black uppercase tracking-wide">
          Failure Counter: {failureCount}
        </p>
      </div>
    </section>
  );
}

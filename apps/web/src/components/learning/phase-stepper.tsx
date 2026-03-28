import {
  getScenarioLearningContent,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { useSimulationUi } from "~/lib/simulation-ui-context";
import type { ServiceName } from "~/lib/event-types";

const serviceColorVarByName: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

export function PhaseStepper({
  scenarioId,
}: {
  scenarioId: SupportedScenarioId;
}) {
  const { currentPhase, setCurrentPhase, requestPhaseJump } = useSimulationUi();
  const phases = getScenarioLearningContent(scenarioId).phases;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider">
        Phase Timeline
      </h3>
      <ol className="space-y-2">
        {phases.map((phase) => {
          const isActive = phase.id === currentPhase;

          return (
            <li key={phase.id}>
              <button
                type="button"
                onClick={() => {
                  setCurrentPhase(phase.id);
                  requestPhaseJump(phase.id);
                }}
                className={`neo-panel w-full text-left transition-transform duration-150 ${isActive ? "bg-[var(--main)] text-[var(--background)]" : "bg-[var(--surface)]"}`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center border-2 border-[var(--border)] bg-[var(--background)] text-xs font-black text-[var(--foreground)]">
                    {phase.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{phase.title}</p>
                    <p
                      className={`text-xs ${isActive ? "text-[var(--background)]/85" : "opacity-80"}`}
                    >
                      {phase.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 px-3 pb-2">
                  {phase.services.map((service) => (
                    <span
                      key={`${phase.id}-${service}`}
                      className="inline-flex items-center rounded-sm border-2 border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--foreground)]"
                      style={{
                        borderColor: `var(${serviceColorVarByName[service]})`,
                      }}
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

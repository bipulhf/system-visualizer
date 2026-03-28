import { cn } from "~/lib/utils";
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
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Phase Timeline
      </h3>
      <ol className="relative space-y-1 pl-6 before:absolute before:left-[9px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[var(--border)]">
        {phases.map((phase) => {
          const isActive = phase.id === currentPhase;

          return (
            <li key={phase.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[15px] top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                  isActive
                    ? "border-[var(--main)] bg-[var(--main)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
                )}
              >
                {phase.id}
              </span>
              <button
                type="button"
                aria-current={isActive ? "step" : undefined}
                onClick={() => {
                  setCurrentPhase(phase.id);
                  requestPhaseJump(phase.id);
                }}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left transition-colors",
                  isActive ? "" : "hover:bg-[var(--surface-2)]",
                )}
                style={
                  isActive
                    ? {
                        background:
                          "color-mix(in oklch, var(--main) 10%, transparent)",
                      }
                    : undefined
                }
              >
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isActive && "text-[var(--main)]",
                  )}
                >
                  {phase.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {phase.description}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {phase.services.map((service) => (
                    <span
                      key={`${phase.id}-${service}`}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: `color-mix(in oklch, var(${serviceColorVarByName[service]}) 15%, transparent)`,
                        color: `var(${serviceColorVarByName[service]})`,
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

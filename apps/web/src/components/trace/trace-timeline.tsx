import type { ServiceName } from "~/lib/event-types";
import type { TraceStep } from "~/lib/trace-types";
import { cn } from "~/lib/utils";

const serviceColorVar: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

export function TraceTimeline({
  steps,
  currentIndex,
  onSelect,
}: {
  steps: TraceStep[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="card rounded-xl p-3">
      {/* Dot scrubber — wraps on small screens */}
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isPast = index < currentIndex;

          return (
            <button
              key={step.id}
              onClick={() => onSelect(index)}
              title={`Step ${index + 1}: ${step.kind}`}
              className={cn(
                "h-3 w-3 shrink-0 rounded-full border-2 transition-all duration-150",
                isActive
                  ? "scale-125 border-transparent"
                  : isPast
                    ? "border-transparent opacity-60"
                    : "border-[var(--border)] bg-transparent",
              )}
              style={
                isActive || isPast
                  ? { background: `var(${serviceColorVar[step.source]})` }
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Scrollable step list — stays inside the card */}
      <div className="mt-2.5 w-full overflow-x-auto">
        <ol className="flex w-max gap-0.5">
          {steps.map((step, index) => {
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;

            return (
              <li key={step.id} className="w-[56px] shrink-0">
                <button
                  onClick={() => onSelect(index)}
                  className={cn(
                    "w-full rounded px-1 py-1.5 text-left text-[10px] transition-colors",
                    isActive
                      ? "font-semibold"
                      : isPast
                        ? "text-[var(--muted)] hover:bg-[var(--surface-2)]"
                        : "text-[var(--muted)] opacity-50 hover:opacity-70",
                  )}
                  style={
                    isActive
                      ? {
                          background: `color-mix(in oklch, var(${serviceColorVar[step.source]}) 12%, transparent)`,
                          color: `var(${serviceColorVar[step.source]})`,
                        }
                      : undefined
                  }
                >
                  <div className="truncate">{step.source}</div>
                  <div className="truncate opacity-70">{step.latencyMs}ms</div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

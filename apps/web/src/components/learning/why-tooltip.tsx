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

export function WhyTooltip({
  scenarioId,
}: {
  scenarioId: SupportedScenarioId;
}) {
  const { selectedService, setSelectedService } = useSimulationUi();
  const scenarioContent = getScenarioLearningContent(scenarioId);
  const whyTechByService = scenarioContent.whyTechByService;
  const activeService = selectedService ?? "elysia";
  const content = whyTechByService[activeService];

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Why This Tech?
      </h3>
      <div className="flex flex-wrap gap-1">
        {serviceOrder.map((service) => (
          <button
            key={service}
            type="button"
            aria-pressed={service === activeService}
            onClick={() => {
              setSelectedService(service);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              service === activeService
                ? "bg-[var(--main)] text-white"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {service}
          </button>
        ))}
      </div>
      <div className="card-inset rounded-lg p-3">
        <p className="text-sm font-semibold">{content.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          {content.reason}
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">
            vs naive approach:
          </span>{" "}
          {content.comparison}
        </p>
        <p className="mt-2 text-xs font-semibold">
          Key metric: {content.keyMetric}
        </p>
      </div>
    </section>
  );
}

import type { ServiceName } from "~/lib/event-types";
import { whyTechByService } from "~/lib/learning-content";
import { useSimulationUi } from "~/lib/simulation-ui-context";

const serviceOrder: ServiceName[] = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
];

export function WhyTooltip() {
  const { selectedService, setSelectedService } = useSimulationUi();
  const activeService = selectedService ?? "elysia";
  const content = whyTechByService[activeService];

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider">
        Why This Tech?
      </h3>
      <div className="flex flex-wrap gap-1">
        {serviceOrder.map((service) => (
          <button
            key={service}
            type="button"
            onClick={() => {
              setSelectedService(service);
            }}
            className={`neo-panel px-2 py-1 text-[11px] font-bold uppercase ${service === activeService ? "bg-[var(--main)] text-[var(--background)]" : "bg-[var(--surface)]"}`}
          >
            {service}
          </button>
        ))}
      </div>
      <article className="neo-panel bg-[var(--surface)] p-3">
        <p className="text-sm font-black">{content.title}</p>
        <p className="mt-1 text-xs leading-relaxed">{content.reason}</p>
        <p className="mt-2 text-xs font-semibold opacity-90">
          Instead of naive approach: {content.comparison}
        </p>
        <p className="mt-2 text-[11px] font-black uppercase tracking-wide">
          Key Metric: {content.keyMetric}
        </p>
      </article>
    </section>
  );
}

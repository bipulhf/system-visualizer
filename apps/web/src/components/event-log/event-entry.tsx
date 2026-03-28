import type { SimulationEvent, ServiceName } from "~/lib/event-types";
import { cn } from "~/lib/utils";

const serviceColorVarByName: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${minutes}:${seconds}.${milliseconds}`;
}

export function EventEntry({
  event,
  selected,
  onSelect,
}: {
  event: SimulationEvent;
  selected: boolean;
  onSelect: (eventId: string) => void;
}) {
  return (
    <li
      className={cn(
        "h-[92px] overflow-hidden rounded-md border-l-2 px-2 py-1.5 transition-colors",
        selected ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]",
      )}
      style={{
        borderLeftColor: `var(${serviceColorVarByName[event.source]})`,
      }}
    >
      <button
        type="button"
        className="h-full w-full text-left"
        onClick={() => {
          onSelect(event.id);
        }}
        aria-expanded={selected}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="tabular-nums text-[11px] font-medium text-[var(--muted)]">
            {formatTimestamp(event.timestamp)}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: `color-mix(in oklch, var(${serviceColorVarByName[event.source]}) 15%, transparent)`,
              color: `var(${serviceColorVarByName[event.source]})`,
            }}
          >
            {event.source}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-semibold">{event.kind}</p>
        <p className="line-clamp-2 text-xs text-[var(--muted)]">
          {event.description}
        </p>
      </button>
    </li>
  );
}

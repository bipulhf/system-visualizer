import type { SimulationEvent, ServiceName } from "~/lib/event-types";

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
      className={`neo-panel h-[92px] bg-[var(--background)] px-2 py-1 ${selected ? "bg-[var(--surface)]" : ""}`}
      style={{ borderColor: `var(${serviceColorVarByName[event.source]})` }}
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
          <span className="text-[11px] font-black">
            {formatTimestamp(event.timestamp)}
          </span>
          <span className="text-[11px] font-bold uppercase">
            {event.source}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-black">{event.kind}</p>
        <p className="line-clamp-2 text-xs font-semibold opacity-85">
          {event.description}
        </p>
      </button>
    </li>
  );
}

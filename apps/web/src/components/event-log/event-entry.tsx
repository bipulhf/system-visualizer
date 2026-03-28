import { useState } from "react";
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
  learnMore,
}: {
  event: SimulationEvent;
  learnMore: string;
}) {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <li
      className="neo-panel bg-[var(--background)] px-2 py-1"
      style={{ borderColor: `var(${serviceColorVarByName[event.source]})` }}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => {
          setExpanded(!expanded);
        }}
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
        <p className="text-xs font-semibold opacity-85">{event.description}</p>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-1 border-t-2 border-[var(--border)] pt-2 text-[11px]">
          <p className="font-bold">Latency: {event.latencyMs} ms</p>
          <p className="font-bold">Learn More: {learnMore}</p>
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all bg-[var(--surface)] p-1.5 font-mono text-[10px]">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>
      ) : null}
    </li>
  );
}

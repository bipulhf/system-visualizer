import { useMemo } from "react";
import { FlowCanvas } from "~/components/flow/flow-canvas";
import { Button } from "~/components/ui/button";
import { useFlowState } from "~/hooks/use-flow-state";
import { useSimulation } from "~/hooks/use-simulation";
import type { ServiceName, SimulationEvent } from "~/lib/event-types";

const serviceColorVarByName: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

const connectionColorByState: Record<
  "connecting" | "open" | "closed" | "error",
  string
> = {
  connecting: "bg-amber-500",
  open: "bg-emerald-500",
  closed: "bg-zinc-500",
  error: "bg-red-500",
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

  return `${minutes}:${seconds}.${milliseconds}`;
}

function getEventDescription(event: SimulationEvent): string {
  if (event.description.length > 0) {
    return event.description;
  }

  return `${event.kind} from ${event.source}`;
}

export function MainCanvasShell() {
  const { events, connectionState, clearEvents } = useSimulation();
  const { nodes, edges, metrics } = useFlowState(events);

  const recentEvents = useMemo(() => {
    const copy = [...events];
    copy.reverse();
    return copy.slice(0, 18);
  }, [events]);

  return (
    <section className="neo-panel grid min-h-[60dvh] grid-rows-[1fr,auto,auto] gap-3 bg-[var(--background)] p-3">
      <div className="neo-panel relative overflow-hidden bg-[var(--surface)] p-4">
        <div className="absolute -top-16 right-8 h-40 w-40 rounded-full bg-[var(--main)]/25 blur-2xl" />
        <div className="absolute -bottom-14 left-8 h-32 w-32 rounded-full bg-[var(--rabbitmq)]/35 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black uppercase tracking-wide">
            Architecture Flow Canvas
          </h2>
          <div className="flex items-center gap-2">
            <span className="neo-panel inline-flex items-center gap-2 bg-[var(--background)] px-2 py-1 text-[11px] font-black uppercase">
              <span
                className={`h-2.5 w-2.5 rounded-full ${connectionColorByState[connectionState]}`}
              />
              ws {connectionState}
            </span>
            <Button size="sm" variant="ghost" onClick={clearEvents}>
              Clear Log
            </Button>
          </div>
        </div>
        <div className="relative z-10 mt-4">
          <FlowCanvas nodes={nodes} edges={edges} />
        </div>
      </div>

      <div className="neo-panel bg-[var(--surface)] p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Activity Monitor
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div
              key={metric.service}
              className="neo-panel bg-[var(--background)] px-2 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-black">{metric.label}</p>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: `var(${serviceColorVarByName[metric.service]})`,
                  }}
                />
              </div>
              <p className="mt-1 font-semibold">
                Ops/s: {metric.opsPerSec.toFixed(1)}
              </p>
              <p className="font-semibold">Queue: {metric.queueDepth}</p>
              <p className="font-semibold">Avg: {metric.avgLatencyMs} ms</p>
              <p className="font-semibold">Errors: {metric.errorCount}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="neo-panel bg-[var(--surface)] p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Event Log
        </h3>
        {recentEvents.length === 0 ? (
          <p className="mt-2 text-xs font-semibold opacity-75">
            Waiting for simulation events...
          </p>
        ) : (
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto pr-1 text-xs">
            {recentEvents.map((event) => (
              <li
                key={event.id}
                className="neo-panel bg-[var(--background)] px-2 py-1"
                style={{
                  borderColor: `var(${serviceColorVarByName[event.source]})`,
                }}
              >
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span>{formatTimestamp(event.timestamp)}</span>
                  <span>{event.kind}</span>
                </div>
                <p className="mt-0.5 font-semibold opacity-90">
                  {getEventDescription(event)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

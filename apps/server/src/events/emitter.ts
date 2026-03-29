import { EventEmitter } from "node:events";
import type { SimulationEvent, SimulationEventInput } from "./types";

const simulationEventBus = new EventEmitter();
const simulationEventName = "simulation-event";

export function emitSimulationEvent(
  input: SimulationEventInput,
): SimulationEvent {
  const event: SimulationEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...input,
  };

  simulationEventBus.emit(simulationEventName, event);
  return event;
}

export async function captureTraceEvents(
  requestId: string,
  runner: () => Promise<void>,
  asyncSettleMs = 2500,
): Promise<SimulationEvent[]> {
  const events: SimulationEvent[] = [];

  const prefix = requestId + ":";
  const unsub = onSimulationEvent((event) => {
    const evtRequestId = event.data["requestId"];
    if (
      typeof evtRequestId === "string" &&
      (evtRequestId === requestId || evtRequestId.startsWith(prefix))
    ) {
      events.push(event);
    }
  });

  try {
    await runner();
  } catch {
    // still return partial events
  }

  // Wait for async downstream events (BullMQ worker, RabbitMQ consumer)
  await new Promise<void>((resolve) => setTimeout(resolve, asyncSettleMs));

  unsub();
  return events;
}

export function onSimulationEvent(
  listener: (event: SimulationEvent) => void,
): () => void {
  simulationEventBus.on(simulationEventName, listener);

  return () => {
    simulationEventBus.off(simulationEventName, listener);
  };
}

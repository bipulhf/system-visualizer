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

export function onSimulationEvent(
  listener: (event: SimulationEvent) => void,
): () => void {
  simulationEventBus.on(simulationEventName, listener);

  return () => {
    simulationEventBus.off(simulationEventName, listener);
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SimulationEvent } from "~/lib/event-types";
import {
  createSimulationWebSocket,
  type SimulationConnectionState,
} from "~/lib/ws-client";

const maxRetainedEvents = 300;

export function useSimulation(): {
  events: SimulationEvent[];
  connectionState: SimulationConnectionState;
  clearEvents: () => void;
} {
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<SimulationConnectionState>("connecting");

  const socketClient = useMemo(() => {
    return createSimulationWebSocket({
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onEvent: (event) => {
        setEvents((previous) => {
          const next = [...previous, event];
          if (next.length <= maxRetainedEvents) {
            return next;
          }

          return next.slice(next.length - maxRetainedEvents);
        });
      },
    });
  }, []);

  useEffect(() => {
    socketClient.connect();

    return () => {
      socketClient.disconnect();
    };
  }, [socketClient]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    connectionState,
    clearEvents,
  };
}

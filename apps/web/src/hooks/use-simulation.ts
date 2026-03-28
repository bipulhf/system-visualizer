import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackRate } from "~/hooks/use-playback";
import type { SimulationEvent } from "~/lib/event-types";
import {
  createSimulationWebSocket,
  type SimulationConnectionState,
  type SimulationScenario,
} from "~/lib/ws-client";

const maxRetainedEvents = 300;

type UseSimulationOptions = {
  paused: boolean;
  playbackRate: PlaybackRate;
  stepCounter: number;
  scenarioId: SimulationScenario;
};

export function useSimulation({
  paused,
  playbackRate,
  stepCounter,
  scenarioId,
}: UseSimulationOptions): {
  events: SimulationEvent[];
  bufferedCount: number;
  connectionState: SimulationConnectionState;
  clearEvents: () => void;
  jumpToPhase: (phase: number) => void;
} {
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [bufferedCount, setBufferedCount] = useState<number>(0);
  const [connectionState, setConnectionState] =
    useState<SimulationConnectionState>("connecting");
  const pausedRef = useRef<boolean>(paused);
  const playbackRateRef = useRef<PlaybackRate>(playbackRate);
  const scenarioRef = useRef<SimulationScenario>(scenarioId);
  const bufferedEventsRef = useRef<SimulationEvent[]>([]);
  const timeoutIdsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const previousStepRef = useRef<number>(stepCounter);

  const appendEvent = useCallback((event: SimulationEvent) => {
    setEvents((previous) => {
      const next = [...previous, event];
      if (next.length <= maxRetainedEvents) {
        return next;
      }

      return next.slice(next.length - maxRetainedEvents);
    });
  }, []);

  const releaseBufferedEvents = useCallback(
    (count: number) => {
      if (count <= 0 || bufferedEventsRef.current.length === 0) {
        return;
      }

      const released = bufferedEventsRef.current.splice(0, count);
      setBufferedCount(bufferedEventsRef.current.length);

      for (const event of released) {
        appendEvent(event);
      }
    },
    [appendEvent],
  );

  const socketClient = useMemo(() => {
    return createSimulationWebSocket({
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onEvent: (event) => {
        if (event.scenario !== scenarioRef.current) {
          return;
        }

        if (pausedRef.current) {
          bufferedEventsRef.current.push(event);
          setBufferedCount(bufferedEventsRef.current.length);
          return;
        }

        const delay = Math.max(
          0,
          Math.round(220 / playbackRateRef.current) - 40,
        );

        if (delay === 0) {
          appendEvent(event);
          return;
        }

        const timer = setTimeout(() => {
          appendEvent(event);
        }, delay);

        timeoutIdsRef.current.push(timer);
      },
    });
  }, [appendEvent]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    scenarioRef.current = scenarioId;
  }, [scenarioId]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const delta = stepCounter - previousStepRef.current;
    previousStepRef.current = stepCounter;

    if (!paused || delta <= 0) {
      return;
    }

    releaseBufferedEvents(delta);
  }, [paused, releaseBufferedEvents, stepCounter]);

  useEffect(() => {
    if (paused || bufferedEventsRef.current.length === 0) {
      return;
    }

    const queued = [...bufferedEventsRef.current];
    bufferedEventsRef.current = [];
    setBufferedCount(0);

    queued.forEach((event, index) => {
      const interval = Math.max(1, Math.round(180 / playbackRateRef.current));
      const timer = setTimeout(() => {
        appendEvent(event);
      }, interval * index);

      timeoutIdsRef.current.push(timer);
    });
  }, [appendEvent, paused]);

  useEffect(() => {
    socketClient.connect();

    return () => {
      for (const timer of timeoutIdsRef.current) {
        clearTimeout(timer);
      }
      timeoutIdsRef.current = [];

      socketClient.disconnect();
    };
  }, [socketClient]);

  useEffect(() => {
    if (connectionState !== "open") {
      return;
    }

    socketClient.setScenario(scenarioId);
  }, [connectionState, scenarioId, socketClient]);

  useEffect(() => {
    setEvents([]);
    bufferedEventsRef.current = [];
    setBufferedCount(0);
  }, [scenarioId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    bufferedEventsRef.current = [];
    setBufferedCount(0);
  }, []);

  const jumpToPhase = useCallback(
    (phase: number) => {
      socketClient.jumpToPhase(phase);
    },
    [socketClient],
  );

  return {
    events,
    bufferedCount,
    connectionState,
    clearEvents,
    jumpToPhase,
  };
}

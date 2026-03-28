import {
  isEventKind,
  isServiceName,
  type EventDataValue,
  type SimulationEvent,
  type ServiceName,
} from "~/lib/event-types";

export type SimulationConnectionState =
  | "connecting"
  | "open"
  | "closed"
  | "error";

export type SimulationScenario =
  | "flash-sale"
  | "ride-sharing"
  | "video-pipeline";

type SimulationSocketHandlers = {
  onStateChange: (state: SimulationConnectionState) => void;
  onEvent: (event: SimulationEvent) => void;
};

type SimulationCommand = {
  command: "jump_phase";
  phase: number;
};

type ScenarioCommand = {
  command: "set_scenario";
  scenario: SimulationScenario;
};

type RawSimulationEvent = {
  id?: string;
  timestamp?: number;
  scenario?: string;
  phase?: number;
  kind?: string;
  source?: string;
  target?: string;
  data?: Record<string, EventDataValue>;
  latencyMs?: number;
  description?: string;
  learnMore?: string;
};

function resolveSimulationWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://localhost:3001/ws/simulation`;
}

function parseSimulationEvent(payload: string): SimulationEvent | null {
  try {
    const raw = JSON.parse(payload) as RawSimulationEvent;

    if (
      typeof raw.id !== "string" ||
      typeof raw.timestamp !== "number" ||
      typeof raw.scenario !== "string" ||
      typeof raw.phase !== "number" ||
      typeof raw.kind !== "string" ||
      typeof raw.source !== "string" ||
      typeof raw.latencyMs !== "number" ||
      typeof raw.description !== "string"
    ) {
      return null;
    }

    if (!isEventKind(raw.kind) || !isServiceName(raw.source)) {
      return null;
    }

    if (!raw.data || typeof raw.data !== "object" || Array.isArray(raw.data)) {
      return null;
    }

    let parsedTarget: ServiceName | undefined;
    if (raw.target !== undefined) {
      if (!isServiceName(raw.target)) {
        return null;
      }
      parsedTarget = raw.target;
    }

    const parsedEvent: SimulationEvent = {
      id: raw.id,
      timestamp: raw.timestamp,
      scenario: raw.scenario,
      phase: raw.phase,
      kind: raw.kind,
      source: raw.source,
      data: raw.data,
      latencyMs: raw.latencyMs,
      description: raw.description,
    };

    if (parsedTarget !== undefined) {
      parsedEvent.target = parsedTarget;
    }

    if (typeof raw.learnMore === "string") {
      parsedEvent.learnMore = raw.learnMore;
    }

    return parsedEvent;
  } catch {
    return null;
  }
}

export function createSimulationWebSocket(handlers: SimulationSocketHandlers): {
  connect: () => void;
  disconnect: () => void;
  jumpToPhase: (phase: number) => void;
  setScenario: (scenario: SimulationScenario) => void;
} {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;

  const connect = (): void => {
    handlers.onStateChange("connecting");
    socket = new WebSocket(resolveSimulationWsUrl());

    socket.onopen = () => {
      handlers.onStateChange("open");
    };

    socket.onmessage = (messageEvent: MessageEvent<string>) => {
      if (typeof messageEvent.data !== "string") {
        return;
      }

      const parsed = parseSimulationEvent(messageEvent.data);
      if (!parsed) {
        return;
      }

      handlers.onEvent(parsed);
    };

    socket.onerror = () => {
      handlers.onStateChange("error");
    };

    socket.onclose = () => {
      handlers.onStateChange("closed");

      if (!shouldReconnect) {
        return;
      }

      reconnectTimer = setTimeout(() => {
        connect();
      }, 900);
    };
  };

  const disconnect = (): void => {
    shouldReconnect = false;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close();
    }

    socket = null;
  };

  const jumpToPhase = (phase: number): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const safePhase = Math.min(5, Math.max(1, Math.trunc(phase)));
    const command: SimulationCommand = {
      command: "jump_phase",
      phase: safePhase,
    };

    socket.send(JSON.stringify(command));
  };

  const setScenario = (scenario: SimulationScenario): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const command: ScenarioCommand = {
      command: "set_scenario",
      scenario,
    };

    socket.send(JSON.stringify(command));
  };

  return {
    connect,
    disconnect,
    jumpToPhase,
    setScenario,
  };
}

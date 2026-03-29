import { Elysia } from "elysia";
import { onSimulationEvent } from "./events/emitter";
import {
  getBankingStatus,
  isBankingScenarioRunning,
  setBankingScenarioPhase,
  setBankingTransferTarget,
  startBankingScenario,
  stopBankingScenario,
} from "./scenarios/banking";
import {
  getFlashSaleStatus,
  isFlashSaleScenarioRunning,
  setFlashSaleRequestTarget,
  setFlashSaleScenarioPhase,
  startFlashSaleScenario,
  stopFlashSaleScenario,
} from "./scenarios/flash-sale";
import {
  getRideSharingStatus,
  isRideSharingScenarioRunning,
  setRideSharingRequestTarget,
  setRideSharingScenarioPhase,
  startRideSharingScenario,
  stopRideSharingScenario,
} from "./scenarios/ride-sharing";
import {
  getVideoPipelineStatus,
  isVideoPipelineScenarioRunning,
  setVideoPipelineScenarioPhase,
  setVideoPipelineUploadTarget,
  startVideoPipelineScenario,
  stopVideoPipelineScenario,
} from "./scenarios/video-pipeline";
import {
  checkBullMqConnection,
  closeBullMqConnection,
} from "./services/bullmq";
import { env } from "./services/env";
import { checkKafkaConnection, closeKafkaConnection } from "./services/kafka";
import {
  checkPostgresConnection,
  closePostgresConnection,
} from "./services/postgres";
import {
  checkRabbitMqConnection,
  closeRabbitMqConnection,
} from "./services/rabbitmq";
import { checkRedisConnection, closeRedisConnection } from "./services/redis";
import { runTrace, type TraceScenarioId } from "./scenarios/trace-runner";
import { collectMetricsSnapshot } from "./services/metrics";
import { log } from "./utils/logger";

type ServiceHealth = {
  status: "ok" | "error";
  message: string;
};

type HealthResponse = {
  status: "ok" | "degraded";
  services: {
    redis: ServiceHealth;
    bullmq: ServiceHealth;
    rabbitmq: ServiceHealth;
    kafka: ServiceHealth;
    postgres: ServiceHealth;
  };
};

async function getServiceHealth(): Promise<HealthResponse> {
  const services: HealthResponse["services"] = {
    redis: { status: "ok", message: "connected" },
    bullmq: { status: "ok", message: "connected" },
    rabbitmq: { status: "ok", message: "connected" },
    kafka: { status: "ok", message: "connected" },
    postgres: { status: "ok", message: "connected" },
  };

  await checkRedisConnection().catch((error: Error) => {
    services.redis = { status: "error", message: error.message };
  });

  await checkBullMqConnection().catch((error: Error) => {
    services.bullmq = { status: "error", message: error.message };
  });

  await checkRabbitMqConnection().catch((error: Error) => {
    services.rabbitmq = { status: "error", message: error.message };
  });

  await checkKafkaConnection().catch((error: Error) => {
    services.kafka = { status: "error", message: error.message };
  });

  await checkPostgresConnection().catch((error: Error) => {
    services.postgres = { status: "error", message: error.message };
  });

  const hasFailure = Object.values(services).some(
    (service) => service.status === "error",
  );

  return {
    status: hasFailure ? "degraded" : "ok",
    services,
  };
}

let simulationClientCount = 0;

type ActiveScenarioId =
  | "flash-sale"
  | "ride-sharing"
  | "video-pipeline"
  | "banking";

type ScenarioStatus =
  | ReturnType<typeof getBankingStatus>
  | ReturnType<typeof getFlashSaleStatus>
  | ReturnType<typeof getRideSharingStatus>
  | ReturnType<typeof getVideoPipelineStatus>;

let activeScenario: ActiveScenarioId = "flash-sale";

function isScenarioRunning(scenario: ActiveScenarioId): boolean {
  if (scenario === "banking") {
    return isBankingScenarioRunning();
  }

  if (scenario === "flash-sale") {
    return isFlashSaleScenarioRunning();
  }

  if (scenario === "ride-sharing") {
    return isRideSharingScenarioRunning();
  }

  return isVideoPipelineScenarioRunning();
}

function getScenarioStatus(scenario: ActiveScenarioId): ScenarioStatus {
  if (scenario === "banking") {
    return getBankingStatus();
  }

  if (scenario === "flash-sale") {
    return getFlashSaleStatus();
  }

  if (scenario === "ride-sharing") {
    return getRideSharingStatus();
  }

  return getVideoPipelineStatus();
}

async function startScenario(scenario: ActiveScenarioId): Promise<void> {
  if (scenario === "banking") {
    await startBankingScenario();
    return;
  }

  if (scenario === "flash-sale") {
    await startFlashSaleScenario();
    return;
  }

  if (scenario === "ride-sharing") {
    await startRideSharingScenario();
    return;
  }

  await startVideoPipelineScenario();
}

function setScenarioPhase(scenario: ActiveScenarioId, phase: number): void {
  if (scenario === "banking") {
    setBankingScenarioPhase(phase);
    return;
  }

  if (scenario === "flash-sale") {
    setFlashSaleScenarioPhase(phase);
    return;
  }

  if (scenario === "ride-sharing") {
    setRideSharingScenarioPhase(phase);
    return;
  }

  setVideoPipelineScenarioPhase(phase);
}

function getScenarioPhaseLimit(scenario: ActiveScenarioId): number {
  if (scenario === "video-pipeline" || scenario === "banking") {
    return 5;
  }

  return 4;
}

async function stopAllScenarios(): Promise<void> {
  await Promise.all([
    stopBankingScenario(),
    stopFlashSaleScenario(),
    stopRideSharingScenario(),
    stopVideoPipelineScenario(),
  ]);
}

type SimulationCommand = {
  command?: string;
  phase?: number;
  requestTarget?: number;
  scenario?: string;
};

type SimulationMessagePayload =
  | string
  | Uint8Array
  | ArrayBuffer
  | SimulationCommand
  | null
  | undefined;

function normalizeSimulationCommand(
  value: SimulationCommand,
): SimulationCommand | null {
  const normalized: SimulationCommand = {};

  if (typeof value.command === "string") {
    normalized.command = value.command;
  }

  if (typeof value.phase === "number") {
    normalized.phase = value.phase;
  }

  if (typeof value.requestTarget === "number") {
    normalized.requestTarget = value.requestTarget;
  }

  if (typeof value.scenario === "string") {
    normalized.scenario = value.scenario;
  }

  return normalized.command ? normalized : null;
}

function parseSimulationCommand(
  message: SimulationMessagePayload,
): SimulationCommand | null {
  if (message === null || message === undefined) {
    return null;
  }

  if (
    typeof message === "object" &&
    !(message instanceof Uint8Array) &&
    !(message instanceof ArrayBuffer)
  ) {
    return normalizeSimulationCommand(message);
  }

  const payload =
    typeof message === "string"
      ? message
      : message instanceof Uint8Array
        ? new TextDecoder().decode(message)
        : new TextDecoder().decode(new Uint8Array(message));

  try {
    const parsed = JSON.parse(payload) as SimulationCommand;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return normalizeSimulationCommand(parsed);
  } catch {
    return null;
  }
}

const app = new Elysia()
  .onRequest(({ set }) => {
    set.headers["Access-Control-Allow-Origin"] = "*";
    set.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type";
  })
  .options("/*", ({ set }) => {
    set.headers["Access-Control-Allow-Origin"] = "*";
    set.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type";
    return new Response(null, { status: 204 });
  })
  .get("/health", async () => {
    const result = await getServiceHealth();
    return result;
  })
  .get("/metrics", async () => {
    const snapshot = await collectMetricsSnapshot();
    return snapshot;
  })
  .post("/simulation/trace", async ({ query }) => {
    const validScenarios: TraceScenarioId[] = [
      "flash-sale",
      "ride-sharing",
      "video-pipeline",
      "banking",
    ];
    const scenarioParam = query["scenario"];
    const scenarioId: TraceScenarioId =
      validScenarios.includes(scenarioParam as TraceScenarioId)
        ? (scenarioParam as TraceScenarioId)
        : "flash-sale";
    const result = await runTrace(scenarioId);
    return result;
  })
  .get("/simulation/harness", () => {
    const status = getScenarioStatus(activeScenario);

    return {
      running: isScenarioRunning(activeScenario),
      connectedClients: simulationClientCount,
      scenario: activeScenario,
      status,
      bankingStatus: getBankingStatus(),
      flashSaleStatus: getFlashSaleStatus(),
      rideSharingStatus: getRideSharingStatus(),
      videoPipelineStatus: getVideoPipelineStatus(),
    };
  })
  .ws("/ws/simulation", {
    open(ws) {
      ws.subscribe("simulation");
      simulationClientCount += 1;

      // Give clients a short window to send their preferred scenario before
      // auto-starting the default scenario.
      setTimeout(() => {
        if (simulationClientCount > 0 && !isScenarioRunning(activeScenario)) {
          void startScenario(activeScenario);
        }
      }, 100);
    },
    close(ws) {
      ws.unsubscribe("simulation");
      simulationClientCount = Math.max(0, simulationClientCount - 1);

      if (simulationClientCount === 0) {
        void stopAllScenarios();
      }
    },
    message(_, message: SimulationMessagePayload) {
      const command = parseSimulationCommand(message);
      if (command === null) {
        return;
      }

      try {
        if (command.command === "jump_phase") {
          if (typeof command.phase !== "number") {
            return;
          }

          const phase = Math.trunc(command.phase);
          if (phase < 1 || phase > getScenarioPhaseLimit(activeScenario)) {
            return;
          }

          if (!isScenarioRunning(activeScenario)) {
            void startScenario(activeScenario);
          }

          setScenarioPhase(activeScenario, phase);
          return;
        }

        if (command.command === "set_request_target") {
          if (typeof command.requestTarget !== "number") {
            return;
          }

          setFlashSaleRequestTarget(command.requestTarget);
          return;
        }

        if (command.command === "set_ride_request_target") {
          if (typeof command.requestTarget !== "number") {
            return;
          }

          setRideSharingRequestTarget(command.requestTarget);
          return;
        }

        if (command.command === "set_scenario") {
          if (
            command.scenario !== "banking" &&
            command.scenario !== "flash-sale" &&
            command.scenario !== "ride-sharing" &&
            command.scenario !== "video-pipeline"
          ) {
            return;
          }

          const nextScenario = command.scenario;
          if (nextScenario === activeScenario) {
            if (
              simulationClientCount > 0 &&
              !isScenarioRunning(activeScenario)
            ) {
              void startScenario(activeScenario);
            }
            return;
          }

          activeScenario = nextScenario;

          void (async () => {
            await stopAllScenarios();
            if (simulationClientCount > 0) {
              await startScenario(activeScenario);
            }
          })();
          return;
        }

        if (command.command === "set_video_upload_target") {
          if (typeof command.requestTarget !== "number") {
            return;
          }

          setVideoPipelineUploadTarget(command.requestTarget);
          return;
        }

        if (command.command === "set_banking_transfer_target") {
          if (typeof command.requestTarget !== "number") {
            return;
          }

          setBankingTransferTarget(command.requestTarget);
        }
      } catch {
        return;
      }
    },
  })
  .listen(env.serverPort);

const unsubscribeFromSimulationBus = onSimulationEvent((event) => {
  app.server?.publish("simulation", JSON.stringify(event));
});

log("info", "Elysia server started", {
  port: env.serverPort,
});

const shutdown = async (): Promise<void> => {
  unsubscribeFromSimulationBus();
  await stopAllScenarios();

  await Promise.allSettled([
    closeBullMqConnection(),
    closeRabbitMqConnection(),
    closeKafkaConnection(),
    closeRedisConnection(),
    closePostgresConnection(),
  ]);

  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

export type App = typeof app;

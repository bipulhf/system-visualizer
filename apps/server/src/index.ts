import { Elysia } from "elysia";
import { onSimulationEvent } from "./events/emitter";
import {
  getFlashSaleStatus,
  isFlashSaleScenarioRunning,
  setFlashSaleRequestTarget,
  setFlashSaleScenarioPhase,
  startFlashSaleScenario,
  stopFlashSaleScenario,
} from "./scenarios/flash-sale";
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

type SimulationCommand = {
  command?: string;
  phase?: number;
  requestTarget?: number;
};

const app = new Elysia()
  .get("/health", async () => {
    const result = await getServiceHealth();
    return result;
  })
  .get("/simulation/harness", () => {
    const status = getFlashSaleStatus();

    return {
      running: isFlashSaleScenarioRunning(),
      connectedClients: simulationClientCount,
      scenario: "flash-sale",
      status,
    };
  })
  .ws("/ws/simulation", {
    open(ws) {
      ws.subscribe("simulation");
      simulationClientCount += 1;

      if (!isFlashSaleScenarioRunning()) {
        void startFlashSaleScenario();
      }
    },
    close(ws) {
      ws.unsubscribe("simulation");
      simulationClientCount = Math.max(0, simulationClientCount - 1);

      if (simulationClientCount === 0) {
        void stopFlashSaleScenario();
      }
    },
    message(_, message) {
      if (typeof message !== "string") {
        return;
      }

      try {
        const command = JSON.parse(message) as SimulationCommand;
        if (command.command === "jump_phase") {
          if (typeof command.phase !== "number") {
            return;
          }

          const phase = Math.trunc(command.phase);
          if (phase < 1 || phase > 4) {
            return;
          }

          if (!isFlashSaleScenarioRunning()) {
            void startFlashSaleScenario();
          }

          setFlashSaleScenarioPhase(phase);
          return;
        }

        if (command.command === "set_request_target") {
          if (typeof command.requestTarget !== "number") {
            return;
          }

          setFlashSaleRequestTarget(command.requestTarget);
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
  await stopFlashSaleScenario();

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

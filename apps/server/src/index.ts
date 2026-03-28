import { Elysia } from "elysia";
import {
  checkBullMqConnection,
  closeBullMqConnection,
} from "./services/bullmq";
import { env } from "./services/env";
import { checkKafkaConnection } from "./services/kafka";
import {
  checkPostgresConnection,
  closePostgresConnection,
} from "./services/postgres";
import { checkRabbitMqConnection } from "./services/rabbitmq";
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

const app = new Elysia()
  .get("/health", async () => {
    const result = await getServiceHealth();
    return result;
  })
  .listen(env.serverPort);

log("info", "Elysia server started", {
  port: env.serverPort,
});

const shutdown = async (): Promise<void> => {
  await Promise.allSettled([
    closeBullMqConnection(),
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

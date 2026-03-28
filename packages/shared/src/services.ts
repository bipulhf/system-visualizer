import type { ServiceName } from "./events";

export interface ServiceTheme {
  colorVar: string;
  label: string;
}

export const serviceThemes: Record<ServiceName, ServiceTheme> = {
  elysia: { colorVar: "--main", label: "API / Elysia" },
  redis: { colorVar: "--redis", label: "Redis" },
  bullmq: { colorVar: "--bullmq", label: "BullMQ" },
  rabbitmq: { colorVar: "--rabbitmq", label: "RabbitMQ" },
  kafka: { colorVar: "--kafka", label: "Kafka" },
  postgres: { colorVar: "--postgres", label: "PostgreSQL" },
};

export const serviceNames: readonly ServiceName[] = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
];

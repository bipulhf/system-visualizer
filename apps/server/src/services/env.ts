const DEFAULT_SERVER_PORT = 3001;

type EnvConfig = {
  serverPort: number;
  postgresUrl: string;
  redisUrl: string;
  rabbitMqUrl: string;
  kafkaBrokers: string[];
};

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_SERVER_PORT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_SERVER_PORT;
  }

  return parsed;
}

function parseKafkaBrokers(raw: string | undefined): string[] {
  const fallback = ["localhost:9092"];
  if (!raw) {
    return fallback;
  }

  const brokers = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return brokers.length > 0 ? brokers : fallback;
}

export const env: EnvConfig = {
  serverPort: parsePort(process.env.SERVER_PORT),
  postgresUrl:
    process.env.POSTGRES_URL ??
    "postgresql://visualizer:visualizer@localhost:5432/visualizer",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  rabbitMqUrl:
    process.env.RABBITMQ_URL ?? "amqp://visualizer:visualizer@localhost:5672",
  kafkaBrokers: parseKafkaBrokers(process.env.KAFKA_BROKERS),
};

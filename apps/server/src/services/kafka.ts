import { Kafka } from "kafkajs";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const kafka = new Kafka({
  brokers: env.kafkaBrokers,
  clientId: "visualizer-flash-sale-simulation",
});

const defaultTopicName = "flash-sale-events";

const producer = kafka.producer();

const consumerConfigs = [
  { groupId: "flash-sale-analytics", delayMs: 35 },
  { groupId: "flash-sale-notifications", delayMs: 95 },
  { groupId: "flash-sale-fraud", delayMs: 180 },
] as const;

type ConsumerRuntime = {
  consumer: ReturnType<Kafka["consumer"]>;
  connected: boolean;
  groupId: string;
  delayMs: number;
};

const consumerRuntimes: ConsumerRuntime[] = consumerConfigs.map((config) => ({
  consumer: kafka.consumer({ groupId: config.groupId }),
  connected: false,
  groupId: config.groupId,
  delayMs: config.delayMs,
}));

let producerConnected = false;
let topicEnsured = false;

type KafkaPayload = {
  scenario: string;
  phase: number;
  requestId: string;
  detail: string;
};

function serializeKafkaPayload(payload: KafkaPayload): string {
  return `${payload.scenario}|${payload.phase}|${payload.requestId}|${payload.detail}`;
}

function parseKafkaPayload(raw: string): KafkaPayload {
  const parts = raw.split("|");

  return {
    scenario: parts[0] ?? "phase1-harness",
    phase: Number(parts[1] ?? "1"),
    requestId: parts[2] ?? "unknown",
    detail: parts[3] ?? "event",
  };
}

async function ensureKafkaRuntimeConnections(): Promise<void> {
  if (!topicEnsured) {
    const admin = kafka.admin();
    await admin.connect();

    try {
      await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic: defaultTopicName,
            numPartitions: 3,
            replicationFactor: 1,
          },
        ],
      });
      topicEnsured = true;
    } finally {
      await admin.disconnect();
    }
  }

  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }

  for (const runtime of consumerRuntimes) {
    if (runtime.connected) {
      continue;
    }

    await runtime.consumer.connect();
    await runtime.consumer.subscribe({
      topic: defaultTopicName,
      fromBeginning: false,
    });

    await runtime.consumer.run({
      eachMessage: async ({ message }) => {
        if (runtime.delayMs > 0) {
          await Bun.sleep(runtime.delayMs);
        }

        const rawValue = message.value ? message.value.toString() : "";
        const payload = parseKafkaPayload(rawValue);

        emitSimulationEvent({
          scenario: payload.scenario,
          phase: payload.phase,
          kind: "kafka.consumed",
          source: "kafka",
          target: "postgres",
          data: {
            requestId: payload.requestId,
            topic: defaultTopicName,
            detail: payload.detail,
            consumerGroup: runtime.groupId,
          },
          latencyMs: runtime.delayMs,
          description: `Kafka ${runtime.groupId} consumed ${payload.requestId}`,
        });
      },
    });

    runtime.connected = true;
  }
}

export async function checkKafkaConnection(): Promise<void> {
  await ensureKafkaRuntimeConnections();
}

export async function produceKafkaEvent(
  context: SimulationContext,
  detail: string,
  topic: string = defaultTopicName,
): Promise<void> {
  const startedAt = performance.now();
  await ensureKafkaRuntimeConnections();

  const payload: KafkaPayload = {
    scenario: context.scenario,
    phase: context.phase,
    requestId: context.requestId,
    detail,
  };

  await producer.send({
    topic,
    messages: [
      { key: context.requestId, value: serializeKafkaPayload(payload) },
    ],
  });

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "kafka.produced",
    source: "kafka",
    target: "postgres",
    data: {
      requestId: context.requestId,
      topic,
      detail,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `Kafka produced ${context.requestId}`,
  });
}

export async function closeKafkaConnection(): Promise<void> {
  for (const runtime of consumerRuntimes) {
    if (!runtime.connected) {
      continue;
    }

    await runtime.consumer.disconnect();
    runtime.connected = false;
  }

  if (producerConnected) {
    await producer.disconnect();
    producerConnected = false;
  }

  topicEnsured = false;
}

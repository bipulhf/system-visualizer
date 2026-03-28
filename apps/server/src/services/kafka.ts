import { Kafka } from "kafkajs";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const kafka = new Kafka({
  brokers: env.kafkaBrokers,
  clientId: "visualizer-flash-sale-simulation",
});

export type KafkaTopicName =
  | "flash-sale-events"
  | "trip-events"
  | "video-pipeline-events";

const defaultTopicName: KafkaTopicName = "flash-sale-events";

const producer = kafka.producer();

const topicConsumerConfigs: Record<
  KafkaTopicName,
  ReadonlyArray<{ groupId: string; delayMs: number }>
> = {
  "flash-sale-events": [
    { groupId: "flash-sale-analytics", delayMs: 35 },
    { groupId: "flash-sale-notifications", delayMs: 95 },
    { groupId: "flash-sale-fraud", delayMs: 180 },
  ],
  "trip-events": [
    { groupId: "ride-ops", delayMs: 45 },
    { groupId: "ride-passenger-notify", delayMs: 120 },
    { groupId: "ride-billing", delayMs: 220 },
  ],
  "video-pipeline-events": [
    { groupId: "video-analytics", delayMs: 40 },
    { groupId: "video-search-indexer", delayMs: 130 },
    { groupId: "video-notifier", delayMs: 240 },
  ],
};

const topicPartitions: Record<KafkaTopicName, number> = {
  "flash-sale-events": 3,
  "trip-events": 3,
  "video-pipeline-events": 3,
};

type ConsumerRuntime = {
  consumer: ReturnType<Kafka["consumer"]>;
  connected: boolean;
  groupId: string;
  delayMs: number;
  topic: KafkaTopicName;
};

const topicConsumerRuntimes: Record<KafkaTopicName, ConsumerRuntime[]> = {
  "flash-sale-events": topicConsumerConfigs["flash-sale-events"].map(
    (config) => ({
      consumer: kafka.consumer({ groupId: config.groupId }),
      connected: false,
      groupId: config.groupId,
      delayMs: config.delayMs,
      topic: "flash-sale-events",
    }),
  ),
  "trip-events": topicConsumerConfigs["trip-events"].map((config) => ({
    consumer: kafka.consumer({ groupId: config.groupId }),
    connected: false,
    groupId: config.groupId,
    delayMs: config.delayMs,
    topic: "trip-events",
  })),
  "video-pipeline-events": topicConsumerConfigs["video-pipeline-events"].map(
    (config) => ({
      consumer: kafka.consumer({ groupId: config.groupId }),
      connected: false,
      groupId: config.groupId,
      delayMs: config.delayMs,
      topic: "video-pipeline-events",
    }),
  ),
};

let producerConnected = false;
let topicEnsured: Record<KafkaTopicName, boolean> = {
  "flash-sale-events": false,
  "trip-events": false,
  "video-pipeline-events": false,
};

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

async function ensureKafkaRuntimeConnections(
  topic: KafkaTopicName,
): Promise<void> {
  if (!topicEnsured[topic]) {
    const admin = kafka.admin();
    await admin.connect();

    try {
      await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic,
            numPartitions: topicPartitions[topic],
            replicationFactor: 1,
          },
        ],
      });
      topicEnsured[topic] = true;
    } finally {
      await admin.disconnect();
    }
  }

  if (!producerConnected) {
    await producer.connect();
    producerConnected = true;
  }

  for (const runtime of topicConsumerRuntimes[topic]) {
    if (runtime.connected) {
      continue;
    }

    await runtime.consumer.connect();
    await runtime.consumer.subscribe({
      topic,
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
            topic,
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
  await ensureKafkaRuntimeConnections("flash-sale-events");
  await ensureKafkaRuntimeConnections("trip-events");
  await ensureKafkaRuntimeConnections("video-pipeline-events");
}

export async function produceKafkaEvent(
  context: SimulationContext,
  detail: string,
  topic: KafkaTopicName = defaultTopicName,
): Promise<void> {
  const startedAt = performance.now();
  await ensureKafkaRuntimeConnections(topic);

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
  for (const topic of Object.keys(topicConsumerRuntimes) as KafkaTopicName[]) {
    for (const runtime of topicConsumerRuntimes[topic]) {
      if (!runtime.connected) {
        continue;
      }

      await runtime.consumer.disconnect();
      runtime.connected = false;
    }
  }

  if (producerConnected) {
    await producer.disconnect();
    producerConnected = false;
  }

  topicEnsured = {
    "flash-sale-events": false,
    "trip-events": false,
    "video-pipeline-events": false,
  };
}

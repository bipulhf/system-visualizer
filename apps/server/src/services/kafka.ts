import { Kafka } from "kafkajs";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const kafka = new Kafka({
  brokers: env.kafkaBrokers,
  clientId: "visualizer-phase1-simulation",
});

const topicName = "visualizer-phase1-events";

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "visualizer-phase1-group" });

let producerConnected = false;
let consumerConnected = false;
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
        topics: [{ topic: topicName, numPartitions: 1, replicationFactor: 1 }],
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

  if (!consumerConnected) {
    await consumer.connect();
    await consumer.subscribe({ topic: topicName, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
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
            topic: topicName,
            detail: payload.detail,
          },
          latencyMs: 0,
          description: `Kafka consumed ${payload.requestId}`,
        });
      },
    });

    consumerConnected = true;
  }
}

export async function checkKafkaConnection(): Promise<void> {
  await ensureKafkaRuntimeConnections();
}

export async function produceKafkaEvent(
  context: SimulationContext,
  detail: string,
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
    topic: topicName,
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
      topic: topicName,
      detail,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `Kafka produced ${context.requestId}`,
  });
}

export async function closeKafkaConnection(): Promise<void> {
  if (consumerConnected) {
    await consumer.disconnect();
    consumerConnected = false;
  }

  if (producerConnected) {
    await producer.disconnect();
    producerConnected = false;
  }
}

import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const exchangeName = "flash-sale.events.fanout";
const queueNames = [
  "flash-sale.email",
  "flash-sale.invoice",
  "flash-sale.warehouse",
  "flash-sale.fraud",
] as const;

let rabbitConnection: ChannelModel | null = null;
let rabbitChannel: Channel | null = null;
let consumerInitialized = false;

async function ensureRabbitMqChannel(): Promise<Channel> {
  const connection = rabbitConnection ?? (await connect(env.rabbitMqUrl));
  rabbitConnection = connection;

  if (!rabbitChannel) {
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertExchange(exchangeName, "fanout", {
      durable: false,
    });

    for (const queueName of queueNames) {
      await rabbitChannel.assertQueue(queueName, { durable: false });
      await rabbitChannel.bindQueue(queueName, exchangeName, "");
    }
  }

  const channel = rabbitChannel;
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  if (!consumerInitialized) {
    for (const queueName of queueNames) {
      await channel.consume(queueName, (message: ConsumeMessage | null) => {
        if (!message || !rabbitChannel) {
          return;
        }

        const payload = message.content.toString();
        const chunks = payload.split("|");
        const scenario = chunks[0] ?? "flash-sale";
        const phase = Number(chunks[1] ?? "3");
        const requestId = chunks[2] ?? "unknown";

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.consumed",
          source: "rabbitmq",
          target: "kafka",
          data: {
            requestId,
            queue: queueName,
          },
          latencyMs: 0,
          description: `RabbitMQ ${queueName} consumed ${requestId}`,
        });

        rabbitChannel.ack(message);

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.ack",
          source: "rabbitmq",
          target: "kafka",
          data: {
            requestId,
            queue: queueName,
          },
          latencyMs: 0,
          description: `RabbitMQ ACK ${requestId} on ${queueName}`,
        });
      });
    }

    consumerInitialized = true;
  }

  return channel;
}

export async function checkRabbitMqConnection(): Promise<void> {
  const channel = await ensureRabbitMqChannel();
  const assertedQueue = await channel.assertQueue("", {
    exclusive: true,
    autoDelete: true,
  });
  await channel.deleteQueue(assertedQueue.queue);
}

export async function publishRabbitMqMessage(
  context: SimulationContext,
  payload: string,
): Promise<void> {
  const startedAt = performance.now();
  const channel = await ensureRabbitMqChannel();

  const body = `${context.scenario}|${context.phase}|${context.requestId}|${payload}`;
  channel.publish(exchangeName, "", Buffer.from(body));

  const latencyMs = Math.round(performance.now() - startedAt);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.published",
    source: "rabbitmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      exchange: exchangeName,
    },
    latencyMs,
    description: `RabbitMQ published ${context.requestId}`,
  });

  for (const queueName of queueNames) {
    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "rabbitmq.routed",
      source: "rabbitmq",
      target: "kafka",
      data: {
        requestId: context.requestId,
        queue: queueName,
      },
      latencyMs,
      description: `RabbitMQ routed ${context.requestId} to ${queueName}`,
    });
  }
}

export async function closeRabbitMqConnection(): Promise<void> {
  if (rabbitChannel) {
    await rabbitChannel.close();
    rabbitChannel = null;
  }

  if (rabbitConnection) {
    await rabbitConnection.close();
    rabbitConnection = null;
  }

  consumerInitialized = false;
}

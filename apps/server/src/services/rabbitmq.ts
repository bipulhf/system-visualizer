import {
  connect,
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from "amqplib";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const flashExchangeName = "flash-sale.events.fanout";
const flashQueueNames = [
  "flash-sale.email",
  "flash-sale.invoice",
  "flash-sale.warehouse",
  "flash-sale.fraud",
] as const;

const rideExchangeName = "ride-sharing.dispatch.direct";
const rideRoutingKey = "dispatch";
const rideQueueName = "ride-sharing.dispatch.queue";
const rideConsumerNames = [
  "ride-sharing.dispatcher-a",
  "ride-sharing.dispatcher-b",
  "ride-sharing.dispatcher-c",
] as const;

let rabbitConnection: ChannelModel | null = null;
let rabbitChannel: Channel | null = null;
let flashConsumersInitialized = false;
let rideConsumersInitialized = false;

function parseMessageBody(body: string): string[] {
  return body.split("|");
}

async function ensureRabbitMqChannel(): Promise<Channel> {
  const connection = rabbitConnection ?? (await connect(env.rabbitMqUrl));
  rabbitConnection = connection;

  if (!rabbitChannel) {
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertExchange(flashExchangeName, "fanout", {
      durable: false,
    });

    for (const queueName of flashQueueNames) {
      await rabbitChannel.assertQueue(queueName, { durable: false });
      await rabbitChannel.bindQueue(queueName, flashExchangeName, "");
    }

    await rabbitChannel.assertExchange(rideExchangeName, "direct", {
      durable: false,
    });
    await rabbitChannel.assertQueue(rideQueueName, { durable: false });
    await rabbitChannel.bindQueue(
      rideQueueName,
      rideExchangeName,
      rideRoutingKey,
    );
  }

  const channel = rabbitChannel;
  if (!channel) {
    throw new Error("RabbitMQ channel not initialized");
  }

  if (!flashConsumersInitialized) {
    for (const queueName of flashQueueNames) {
      await channel.consume(queueName, (message: ConsumeMessage | null) => {
        if (!message || !rabbitChannel) {
          return;
        }

        const payload = message.content.toString();
        const chunks = parseMessageBody(payload);
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

    flashConsumersInitialized = true;
  }

  if (!rideConsumersInitialized) {
    for (const consumerId of rideConsumerNames) {
      await channel.consume(rideQueueName, (message: ConsumeMessage | null) => {
        if (!message || !rabbitChannel) {
          return;
        }

        const payload = message.content.toString();
        const chunks = parseMessageBody(payload);
        const scenario = chunks[0] ?? "ride-sharing";
        const phase = Number(chunks[1] ?? "3");
        const requestId = chunks[2] ?? "unknown";
        const passengerId = chunks[3] ?? "unknown-passenger";
        const driverId = chunks[4] ?? "unknown-driver";

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.consumed",
          source: "rabbitmq",
          target: "kafka",
          data: {
            requestId,
            queue: rideQueueName,
            consumerId,
            passengerId,
            driverId,
            competingConsumers: rideConsumerNames.length,
          },
          latencyMs: 0,
          description: `RabbitMQ ${consumerId} consumed ${requestId}`,
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
            queue: rideQueueName,
            consumerId,
            passengerId,
            driverId,
          },
          latencyMs: 0,
          description: `RabbitMQ ACK ${requestId} by ${consumerId}`,
        });
      });
    }

    rideConsumersInitialized = true;
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
  channel.publish(flashExchangeName, "", Buffer.from(body));

  const latencyMs = Math.round(performance.now() - startedAt);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.published",
    source: "rabbitmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      exchange: flashExchangeName,
    },
    latencyMs,
    description: `RabbitMQ published ${context.requestId}`,
  });

  for (const queueName of flashQueueNames) {
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

export async function publishRideDispatchMessage(
  context: SimulationContext,
  passengerId: string,
  driverId: string,
): Promise<void> {
  const startedAt = performance.now();
  const channel = await ensureRabbitMqChannel();

  const body = `${context.scenario}|${context.phase}|${context.requestId}|${passengerId}|${driverId}`;
  channel.publish(rideExchangeName, rideRoutingKey, Buffer.from(body));

  const latencyMs = Math.round(performance.now() - startedAt);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.published",
    source: "rabbitmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      passengerId,
      driverId,
      exchange: rideExchangeName,
      routingKey: rideRoutingKey,
    },
    latencyMs,
    description: `RabbitMQ published dispatch ${context.requestId}`,
  });

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.routed",
    source: "rabbitmq",
    target: "kafka",
    data: {
      requestId: context.requestId,
      passengerId,
      driverId,
      queue: rideQueueName,
      routingKey: rideRoutingKey,
      competingConsumers: rideConsumerNames.length,
    },
    latencyMs,
    description: `RabbitMQ routed dispatch ${context.requestId}`,
  });
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

  flashConsumersInitialized = false;
  rideConsumersInitialized = false;
}

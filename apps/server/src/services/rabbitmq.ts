import {
  connect,
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
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

const videoExchangeName = "video-pipeline.events.topic";
const videoRoutingBindings = [
  {
    routingKey: "video.cdn.ready",
    queueName: "video-pipeline.cdn.ready",
  },
  {
    routingKey: "video.search.index",
    queueName: "video-pipeline.search.index",
  },
  {
    routingKey: "video.notify.ready",
    queueName: "video-pipeline.notify.ready",
  },
] as const;

const bankingExchangeName = "banking.fraud.direct";
const bankingRequestRoutingKey = "fraud.check";
const bankingRequestQueueName = "banking.fraud.request";
const bankingReplyQueueName = "banking.fraud.reply";

type BankingFraudDecision = "approved" | "hold";

let rabbitConnection: ChannelModel | null = null;
let rabbitChannel: Channel | null = null;
let rabbitConfirmChannel: ConfirmChannel | null = null;
let flashConsumersInitialized = false;
let rideConsumersInitialized = false;
let videoConsumersInitialized = false;
let bankingConsumersInitialized = false;

const pendingBankingReplies = new Map<
  string,
  (decision: BankingFraudDecision) => void
>();

function parseMessageBody(body: string): string[] {
  return body.split("|");
}

async function ensureRabbitMqChannel(): Promise<Channel> {
  const connection = rabbitConnection ?? (await connect(env.rabbitMqUrl));
  rabbitConnection = connection;

  if (!rabbitChannel) {
    rabbitChannel = await connection.createChannel();
    rabbitConfirmChannel = await connection.createConfirmChannel();
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

    await rabbitChannel.assertExchange(videoExchangeName, "topic", {
      durable: false,
    });

    for (const binding of videoRoutingBindings) {
      await rabbitChannel.assertQueue(binding.queueName, { durable: false });
      await rabbitChannel.bindQueue(
        binding.queueName,
        videoExchangeName,
        binding.routingKey,
      );
    }

    await rabbitChannel.assertExchange(bankingExchangeName, "direct", {
      durable: false,
    });
    await rabbitChannel.assertQueue(bankingRequestQueueName, {
      durable: false,
    });
    await rabbitChannel.assertQueue(bankingReplyQueueName, { durable: false });
    await rabbitChannel.bindQueue(
      bankingRequestQueueName,
      bankingExchangeName,
      bankingRequestRoutingKey,
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

  if (!videoConsumersInitialized) {
    for (const binding of videoRoutingBindings) {
      await channel.consume(
        binding.queueName,
        (message: ConsumeMessage | null) => {
          if (!message || !rabbitChannel) {
            return;
          }

          const payload = message.content.toString();
          const chunks = parseMessageBody(payload);
          const scenario = chunks[0] ?? "video-pipeline";
          const phase = Number(chunks[1] ?? "4");
          const requestId = chunks[2] ?? "unknown";
          const uploadId = chunks[3] ?? "unknown-upload";
          const rendition = chunks[4] ?? "unknown-rendition";
          const routingKey = chunks[5] ?? binding.routingKey;
          const detail = chunks[6] ?? "video_event";

          emitSimulationEvent({
            scenario,
            phase,
            kind: "rabbitmq.consumed",
            source: "rabbitmq",
            target: "kafka",
            data: {
              requestId,
              queue: binding.queueName,
              exchange: videoExchangeName,
              routingKey,
              uploadId,
              rendition,
              detail,
            },
            latencyMs: 0,
            description: `RabbitMQ ${binding.queueName} consumed ${requestId}`,
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
              queue: binding.queueName,
              exchange: videoExchangeName,
              routingKey,
              uploadId,
              rendition,
              detail,
            },
            latencyMs: 0,
            description: `RabbitMQ ACK ${requestId} on ${binding.queueName}`,
          });
        },
      );
    }

    videoConsumersInitialized = true;
  }

  if (!bankingConsumersInitialized) {
    await channel.consume(
      bankingRequestQueueName,
      (message: ConsumeMessage | null) => {
        if (!message || !rabbitChannel) {
          return;
        }

        const payload = message.content.toString();
        const chunks = parseMessageBody(payload);
        const scenario = chunks[0] ?? "banking";
        const phase = Number(chunks[1] ?? "3");
        const requestId = chunks[2] ?? "unknown";
        const transferId = chunks[3] ?? "unknown-transfer";
        const amountCents = Number(chunks[4] ?? "0");
        const riskScore = Number(chunks[5] ?? "0");
        const decision: BankingFraudDecision =
          riskScore >= 72 ? "hold" : "approved";

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.consumed",
          source: "rabbitmq",
          target: "bullmq",
          data: {
            requestId,
            queue: bankingRequestQueueName,
            transferId,
            amountCents,
            riskScore,
          },
          latencyMs: 0,
          description: `RabbitMQ consumed fraud request ${requestId}`,
        });

        const correlationId = message.properties.correlationId ?? "";
        const replyTo = message.properties.replyTo ?? bankingReplyQueueName;
        const replyPayload = `${scenario}|${phase}|${requestId}|${transferId}|${decision}`;

        rabbitChannel.sendToQueue(replyTo, Buffer.from(replyPayload), {
          correlationId,
        });

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.routed",
          source: "rabbitmq",
          target: "bullmq",
          data: {
            requestId,
            queue: replyTo,
            transferId,
            decision,
            correlationId,
            routingKey: "fraud.reply",
          },
          latencyMs: 0,
          description: `RabbitMQ routed fraud reply ${requestId}`,
        });

        rabbitChannel.ack(message);

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.ack",
          source: "rabbitmq",
          target: "bullmq",
          data: {
            requestId,
            queue: bankingRequestQueueName,
            transferId,
            ackType: "consumer_ack",
          },
          latencyMs: 0,
          description: `RabbitMQ ACK fraud request ${requestId}`,
        });
      },
    );

    await channel.consume(
      bankingReplyQueueName,
      (message: ConsumeMessage | null) => {
        if (!message || !rabbitChannel) {
          return;
        }

        const payload = message.content.toString();
        const chunks = parseMessageBody(payload);
        const scenario = chunks[0] ?? "banking";
        const phase = Number(chunks[1] ?? "3");
        const requestId = chunks[2] ?? "unknown";
        const transferId = chunks[3] ?? "unknown-transfer";
        const decisionRaw = chunks[4] ?? "approved";
        const decision: BankingFraudDecision =
          decisionRaw === "hold" ? "hold" : "approved";
        const correlationId = message.properties.correlationId ?? "";

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.consumed",
          source: "rabbitmq",
          target: "bullmq",
          data: {
            requestId,
            queue: bankingReplyQueueName,
            transferId,
            decision,
            correlationId,
          },
          latencyMs: 0,
          description: `RabbitMQ consumed fraud reply ${requestId}`,
        });

        const pendingResolver = pendingBankingReplies.get(correlationId);
        if (pendingResolver) {
          pendingBankingReplies.delete(correlationId);
          pendingResolver(decision);
        }

        rabbitChannel.ack(message);

        emitSimulationEvent({
          scenario,
          phase,
          kind: "rabbitmq.ack",
          source: "rabbitmq",
          target: "bullmq",
          data: {
            requestId,
            queue: bankingReplyQueueName,
            transferId,
            decision,
            correlationId,
            ackType: "consumer_ack",
          },
          latencyMs: 0,
          description: `RabbitMQ ACK fraud reply ${requestId}`,
        });
      },
    );

    bankingConsumersInitialized = true;
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

export async function publishVideoPipelineMessage(
  context: SimulationContext,
  options: {
    uploadId: string;
    rendition: string;
    routingKey: (typeof videoRoutingBindings)[number]["routingKey"];
    detail: string;
  },
): Promise<void> {
  const startedAt = performance.now();
  const channel = await ensureRabbitMqChannel();

  const body = `${context.scenario}|${context.phase}|${context.requestId}|${options.uploadId}|${options.rendition}|${options.routingKey}|${options.detail}`;
  channel.publish(videoExchangeName, options.routingKey, Buffer.from(body));

  const latencyMs = Math.round(performance.now() - startedAt);
  const queueName =
    videoRoutingBindings.find(
      (binding) => binding.routingKey === options.routingKey,
    )?.queueName ?? "video-pipeline.unmatched";

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.published",
    source: "rabbitmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      uploadId: options.uploadId,
      rendition: options.rendition,
      exchange: videoExchangeName,
      routingKey: options.routingKey,
      detail: options.detail,
    },
    latencyMs,
    description: `RabbitMQ published video event ${context.requestId}`,
  });

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.routed",
    source: "rabbitmq",
    target: "kafka",
    data: {
      requestId: context.requestId,
      uploadId: options.uploadId,
      rendition: options.rendition,
      exchange: videoExchangeName,
      routingKey: options.routingKey,
      queue: queueName,
      detail: options.detail,
    },
    latencyMs,
    description: `RabbitMQ routed video event ${context.requestId} to ${queueName}`,
  });
}

export async function requestBankingFraudDecision(
  context: SimulationContext,
  options: {
    transferId: string;
    amountCents: number;
    riskScore: number;
  },
): Promise<BankingFraudDecision> {
  await ensureRabbitMqChannel();

  const confirmChannel = rabbitConfirmChannel;
  if (!confirmChannel) {
    throw new Error("RabbitMQ confirm channel unavailable");
  }

  const correlationId = crypto.randomUUID();
  const messagePayload = `${context.scenario}|${context.phase}|${context.requestId}|${options.transferId}|${options.amountCents}|${options.riskScore}`;

  const startedAt = performance.now();
  await new Promise<void>((resolve, reject) => {
    confirmChannel.publish(
      bankingExchangeName,
      bankingRequestRoutingKey,
      Buffer.from(messagePayload),
      {
        correlationId,
        replyTo: bankingReplyQueueName,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });

  const publishLatencyMs = Math.round(performance.now() - startedAt);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.published",
    source: "rabbitmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      transferId: options.transferId,
      exchange: bankingExchangeName,
      routingKey: bankingRequestRoutingKey,
      riskScore: options.riskScore,
      amountCents: options.amountCents,
      correlationId,
    },
    latencyMs: publishLatencyMs,
    description: `RabbitMQ published fraud request ${context.requestId}`,
  });

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.routed",
    source: "rabbitmq",
    target: "bullmq",
    data: {
      requestId: context.requestId,
      transferId: options.transferId,
      queue: bankingRequestQueueName,
      routingKey: bankingRequestRoutingKey,
      correlationId,
    },
    latencyMs: publishLatencyMs,
    description: `RabbitMQ routed fraud request ${context.requestId}`,
  });

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "rabbitmq.ack",
    source: "rabbitmq",
    target: "bullmq",
    data: {
      requestId: context.requestId,
      transferId: options.transferId,
      queue: bankingRequestQueueName,
      correlationId,
      ackType: "publisher_confirm",
    },
    latencyMs: publishLatencyMs,
    description: `RabbitMQ publisher confirm ${context.requestId}`,
  });

  const decision = await new Promise<BankingFraudDecision>(
    (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pendingBankingReplies.delete(correlationId);
        reject(new Error("banking_fraud_reply_timeout"));
      }, 1_800);

      pendingBankingReplies.set(correlationId, (value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      });
    },
  );

  return decision;
}

type RabbitMqManagementNode = {
  mem_used?: number;
  fd_used?: number;
  proc_used?: number;
};

export async function getRabbitMqManagementStats(): Promise<{ memUsedMb: number } | null> {
  try {
    const normalized = env.rabbitMqUrl.replace(/^amqps?/, "http");
    const parsed = new URL(normalized);
    const credentials = Buffer.from(`${parsed.username}:${parsed.password}`).toString("base64");
    const managementUrl = `http://${parsed.hostname}:15672/api/nodes`;

    const response = await fetch(managementUrl, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      return null;
    }

    const nodes = (await response.json()) as RabbitMqManagementNode[];
    const firstNode = nodes[0];
    if (!firstNode?.mem_used) {
      return null;
    }

    return { memUsedMb: Math.round(firstNode.mem_used / 1024 / 1024) };
  } catch {
    return null;
  }
}

export async function closeRabbitMqConnection(): Promise<void> {
  pendingBankingReplies.clear();

  if (rabbitConfirmChannel) {
    await rabbitConfirmChannel.close();
    rabbitConfirmChannel = null;
  }

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
  videoConsumersInitialized = false;
  bankingConsumersInitialized = false;
}

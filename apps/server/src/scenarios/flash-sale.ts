import { emitSimulationEvent, onSimulationEvent } from "../events/emitter";
import type { SimulationContext, SimulationEvent } from "../events/types";
import { enqueueBullMqJob } from "../services/bullmq";
import { produceKafkaEvent } from "../services/kafka";
import { runPostgresTransaction } from "../services/postgres";
import { publishRabbitMqMessage } from "../services/rabbitmq";
import {
  checkSlidingWindowRateLimit,
  decrementRedisKey,
  incrementRedisKey,
  setRedisValue,
} from "../services/redis";

const scenarioName = "flash-sale";
const kafkaTopic = "flash-sale-events";
const initialStock = 100;
const defaultRequestTarget = 10_000;
const rateLimitWindowMs = 1_000;
const rateLimitMaxRequests = 750;
const ingestionBatchSize = 120;
const ingestionIntervalMs = 40;

type FlashSaleStatus = {
  running: boolean;
  requestTarget: number;
  processedRequests: number;
  acceptedRequests: number;
  rejectedRequests: number;
  completedOrders: number;
  failedOrders: number;
  currentPhase: number;
  auditProduced: number;
};

let running = false;
let requestTarget = defaultRequestTarget;
let processedRequests = 0;
let acceptedRequests = 0;
let rejectedRequests = 0;
let completedOrders = 0;
let failedOrders = 0;
let currentPhase = 0;
let auditProduced = 0;
let ingestionBusy = false;
let auditRunning = false;
let forcedPhase: number | null = null;
let ingestionTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeFromBus: (() => void) | null = null;

const requestOutcomes = new Map<string, string>();
const settledAcceptedRequests = new Set<string>();
const successfulRequestIds = new Set<string>();

function buildContext(requestId: string, phase: number): SimulationContext {
  return {
    scenario: scenarioName,
    phase,
    requestId,
  };
}

function parseRequestId(event: SimulationEvent): string | null {
  const value = event.data.requestId;
  return typeof value === "string" ? value : null;
}

function emitPhaseChange(phase: number, title: string): void {
  if (phase === currentPhase) {
    return;
  }

  currentPhase = phase;
  emitSimulationEvent({
    scenario: scenarioName,
    phase,
    kind: "phase.change",
    source: "elysia",
    target: "redis",
    data: {
      phase,
      title,
    },
    latencyMs: 0,
    description: title,
  });
}

function shouldFailOrder(acceptedIndex: number): boolean {
  return acceptedIndex % 17 === 0;
}

async function processIncomingRequest(index: number): Promise<void> {
  const requestId = `order-${index}`;
  const context = buildContext(requestId, 1);

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: {
      requestId,
      requestIndex: index,
    },
    latencyMs: 0,
    description: `Incoming request ${requestId}`,
  });

  const rateDecision = await checkSlidingWindowRateLimit(
    "flash-sale:rate-window",
    context,
    rateLimitWindowMs,
    rateLimitMaxRequests,
  );

  if (!rateDecision.allowed) {
    rejectedRequests += 1;
    requestOutcomes.set(requestId, "rejected_rate_limit");

    emitSimulationEvent({
      scenario: scenarioName,
      phase: 1,
      kind: "request.rejected",
      source: "elysia",
      target: "redis",
      data: {
        requestId,
        reason: "rate_limit",
        windowCount: rateDecision.count,
      },
      latencyMs: 1,
      description: `Request ${requestId} rejected by rate limiter`,
    });

    return;
  }

  const stockAfterDecrement = await decrementRedisKey("stock:item_42", context);

  if (stockAfterDecrement < 0) {
    await incrementRedisKey("stock:item_42", context);
    rejectedRequests += 1;
    requestOutcomes.set(requestId, "rejected_out_of_stock");

    emitSimulationEvent({
      scenario: scenarioName,
      phase: 1,
      kind: "request.rejected",
      source: "elysia",
      target: "redis",
      data: {
        requestId,
        reason: "out_of_stock",
      },
      latencyMs: 1,
      description: `Request ${requestId} rejected due to stock depletion`,
    });

    return;
  }

  acceptedRequests += 1;
  requestOutcomes.set(requestId, "accepted");

  emitPhaseChange(2, "Phase 2 activated: BullMQ job queuing");

  await enqueueBullMqJob(context, {
    shouldFail: shouldFailOrder(acceptedRequests),
    priority: Math.max(1, initialStock - acceptedRequests + 1),
    attempts: 3,
    backoffDelayMs: 160,
  });
}

async function handleCompletedOrder(event: SimulationEvent): Promise<void> {
  const requestId = parseRequestId(event);
  if (!requestId || settledAcceptedRequests.has(requestId)) {
    return;
  }

  settledAcceptedRequests.add(requestId);
  successfulRequestIds.add(requestId);
  completedOrders += 1;

  emitPhaseChange(3, "Phase 3 activated: RabbitMQ fan-out dispatch");

  await publishRabbitMqMessage(
    buildContext(requestId, 3),
    `order_confirmed:${requestId}`,
  );
  await maybeStartAuditTrail();
}

async function handleFailedOrder(event: SimulationEvent): Promise<void> {
  const requestId = parseRequestId(event);
  const finalFailure = event.data.finalFailure;

  if (
    !requestId ||
    finalFailure !== true ||
    settledAcceptedRequests.has(requestId)
  ) {
    return;
  }

  settledAcceptedRequests.add(requestId);
  failedOrders += 1;
  requestOutcomes.set(requestId, "failed_after_retries");

  await incrementRedisKey("stock:item_42", buildContext(requestId, 2));

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 2,
    kind: "bullmq.job.dlq",
    source: "bullmq",
    target: "rabbitmq",
    data: {
      requestId,
      reason: "payment_retry_exhausted",
    },
    latencyMs: 0,
    description: `Order ${requestId} moved to DLQ after retries`,
  });

  await maybeStartAuditTrail();
}

async function maybeStartAuditTrail(): Promise<void> {
  if (!running || auditRunning) {
    return;
  }

  if (processedRequests < requestTarget) {
    return;
  }

  if (settledAcceptedRequests.size < acceptedRequests) {
    return;
  }

  auditRunning = true;
  emitPhaseChange(4, "Phase 4 activated: Kafka audit trail");

  for (let index = 1; index <= requestTarget; index += 1) {
    const requestId = `order-${index}`;
    const outcome = requestOutcomes.get(requestId) ?? "unknown";

    await produceKafkaEvent(
      buildContext(requestId, 4),
      `request_outcome:${outcome}`,
      kafkaTopic,
    );

    auditProduced += 1;
  }

  for (const requestId of successfulRequestIds) {
    await runPostgresTransaction(buildContext(requestId, 4), "confirmed");
  }

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 4,
    kind: "scenario.complete",
    source: "elysia",
    data: {
      processedRequests,
      acceptedRequests,
      rejectedRequests,
      completedOrders,
      failedOrders,
      kafkaAuditEvents: auditProduced,
    },
    latencyMs: 0,
    description: "Flash-sale scenario complete",
  });

  running = false;

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

function registerEventHandlers(): void {
  unsubscribeFromBus = onSimulationEvent((event) => {
    if (!running || event.scenario !== scenarioName) {
      return;
    }

    if (event.kind === "bullmq.job.completed") {
      void handleCompletedOrder(event);
      return;
    }

    if (event.kind === "bullmq.job.failed") {
      void handleFailedOrder(event);
    }
  });
}

function stopIngestionTimer(): void {
  if (!ingestionTimer) {
    return;
  }

  clearInterval(ingestionTimer);
  ingestionTimer = null;
}

async function runIngestionTick(): Promise<void> {
  if (!running || ingestionBusy) {
    return;
  }

  ingestionBusy = true;

  try {
    if (forcedPhase !== null) {
      emitPhaseChange(
        forcedPhase,
        `Phase ${forcedPhase} activated by user jump`,
      );
      forcedPhase = null;
    }

    const remaining = requestTarget - processedRequests;
    if (remaining <= 0) {
      stopIngestionTimer();
      await maybeStartAuditTrail();
      return;
    }

    const batchSize = Math.min(ingestionBatchSize, remaining);
    const tasks: Array<Promise<void>> = [];

    for (let offset = 0; offset < batchSize; offset += 1) {
      const requestIndex = processedRequests + offset + 1;
      tasks.push(processIncomingRequest(requestIndex));
    }

    processedRequests += batchSize;
    await Promise.all(tasks);

    if (processedRequests >= requestTarget) {
      stopIngestionTimer();
      await maybeStartAuditTrail();
    }
  } finally {
    ingestionBusy = false;
  }
}

export async function startFlashSaleScenario(): Promise<void> {
  if (running) {
    return;
  }

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }

  running = true;
  processedRequests = 0;
  acceptedRequests = 0;
  rejectedRequests = 0;
  completedOrders = 0;
  failedOrders = 0;
  currentPhase = 0;
  auditProduced = 0;
  auditRunning = false;
  ingestionBusy = false;
  forcedPhase = null;
  requestOutcomes.clear();
  settledAcceptedRequests.clear();
  successfulRequestIds.clear();

  await setRedisValue(
    "stock:item_42",
    String(initialStock),
    buildContext("bootstrap", 1),
  );

  registerEventHandlers();
  emitPhaseChange(1, "Phase 1 activated: request spike");

  await runIngestionTick();

  ingestionTimer = setInterval(() => {
    void runIngestionTick();
  }, ingestionIntervalMs);
}

export async function stopFlashSaleScenario(): Promise<void> {
  running = false;
  ingestionBusy = false;
  forcedPhase = null;
  auditRunning = false;

  stopIngestionTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

export function isFlashSaleScenarioRunning(): boolean {
  return running;
}

export function setFlashSaleScenarioPhase(phase: number): void {
  if (phase < 1 || phase > 4) {
    return;
  }

  forcedPhase = phase;
}

export function setFlashSaleRequestTarget(target: number): void {
  requestTarget = Math.max(initialStock, Math.trunc(target));
}

export function getFlashSaleStatus(): FlashSaleStatus {
  return {
    running,
    requestTarget,
    processedRequests,
    acceptedRequests,
    rejectedRequests,
    completedOrders,
    failedOrders,
    currentPhase,
    auditProduced,
  };
}

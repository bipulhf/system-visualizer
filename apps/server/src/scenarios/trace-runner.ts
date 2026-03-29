import { captureTraceEvents, emitSimulationEvent } from "../events/emitter";
import type { TraceResult, TraceStep } from "../events/types";
import {
  enqueueBullMqJob,
  enqueueRideDispatchJob,
  enqueueVideoPipelineChildJob,
  enqueueVideoPipelineParentJob,
} from "../services/bullmq";
import { produceKafkaEvent } from "../services/kafka";
import {
  runBankingAuditRead,
  runBankingSerializableTransfer,
  runPostgresTransaction,
  runRideSharingTripCompletion,
  runVideoPipelineFinalize,
  runVideoPipelineUploadIntake,
  seedBankingAccounts,
  updateBankingLedgerStatus,
} from "../services/postgres";
import {
  publishRabbitMqMessage,
  publishRideDispatchMessage,
  publishVideoPipelineMessage,
  requestBankingFraudDecision,
} from "../services/rabbitmq";
import {
  checkSlidingWindowRateLimit,
  decrementRedisKey,
  deleteRedisKey,
  geoAddDriverLocation,
  geoSearchNearbyDrivers,
  setRedisValue,
  setRedisValueIfAbsent,
} from "../services/redis";

export type TraceScenarioId =
  | "flash-sale"
  | "ride-sharing"
  | "video-pipeline"
  | "banking";

const geoKey = "trace:drivers:geo";
const stockKey = "trace:stock:item_42";

// ── Flash Sale ──────────────────────────────────────────────────────────────

async function runFlashSaleTrace(requestId: string): Promise<void> {
  const ctx = (phase: number) => ({
    scenario: "trace-flash-sale",
    phase,
    requestId,
  });

  emitSimulationEvent({
    scenario: "trace-flash-sale",
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: { requestId, requestKind: "flash_sale_order" },
    latencyMs: 0,
    description: `API accepted flash-sale order ${requestId}`,
    learnMore:
      "Elysia receives the HTTP request. Before touching any inventory, the rate limiter and stock level are checked in Redis.",
  });

  await checkSlidingWindowRateLimit(
    "trace:flash:rate",
    ctx(1),
    1000,
    750,
  );
  await decrementRedisKey(stockKey, ctx(1));

  await enqueueBullMqJob(ctx(2), {
    shouldFail: false,
    priority: 1,
    attempts: 3,
    backoffDelayMs: 160,
  });

  await publishRabbitMqMessage(ctx(3), `order_confirmed:${requestId}`);
  await produceKafkaEvent(ctx(4), `request_outcome:confirmed`, "flash-sale-events");
  await runPostgresTransaction(ctx(4), "confirmed");
}

// ── Ride Sharing ─────────────────────────────────────────────────────────────

async function runRideSharingTrace(requestId: string): Promise<void> {
  const ctx = (phase: number) => ({
    scenario: "trace-ride-sharing",
    phase,
    requestId,
  });

  const bootstrapCtx = {
    scenario: "trace-ride-sharing",
    phase: 0,
    requestId: `${requestId}:bootstrap`,
  };

  // Seed one driver so geo search finds a result
  await geoAddDriverLocation(
    geoKey,
    "trace-driver-1",
    -122.4194,
    37.7749,
    60,
    bootstrapCtx,
  );

  emitSimulationEvent({
    scenario: "trace-ride-sharing",
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: { requestId, requestKind: "ride_request", passengerId: "trace-passenger-1" },
    latencyMs: 0,
    description: `Ride request received for trace-passenger-1`,
    learnMore:
      "Elysia receives the ride request. Redis GEO commands find nearby drivers, then a BullMQ job races to match passenger with driver.",
  });

  await geoSearchNearbyDrivers(geoKey, -122.4194, 37.7749, 3, 5, ctx(1));

  await enqueueRideDispatchJob(ctx(2), {
    passengerId: "trace-passenger-1",
    candidateDriverIds: ["trace-driver-1"],
    attempt: 1,
    searchRadiusKm: 3,
    timeoutSeconds: 30,
    forceRetry: false,
    retryDelayMs: 0,
  });

  await publishRideDispatchMessage(ctx(3), "trace-passenger-1", "trace-driver-1");

  await produceKafkaEvent(ctx(4), "trip_state:completed", "trip-events");
  await runRideSharingTripCompletion(
    ctx(4),
    "trace-passenger-1",
    "trace-driver-1",
    "completed",
  );
}

// ── Video Pipeline ───────────────────────────────────────────────────────────

async function runVideoPipelineTrace(requestId: string): Promise<void> {
  const uploadId = `trace-upload-${requestId}`;

  const ctx = (phase: number, suffix = "") => ({
    scenario: "trace-video-pipeline",
    phase,
    requestId: suffix ? `${requestId}:${suffix}` : requestId,
  });

  emitSimulationEvent({
    scenario: "trace-video-pipeline",
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "postgres",
    data: { requestId, uploadId, requestKind: "video_upload" },
    latencyMs: 0,
    description: `Video upload received ${uploadId}`,
    learnMore:
      "Elysia accepts the upload. Postgres records the intake, then BullMQ fans out one parent job and one child job per rendition.",
  });

  await runVideoPipelineUploadIntake(ctx(1), uploadId);

  const parentJobId = await enqueueVideoPipelineParentJob(
    ctx(1, "parent"),
    { uploadId, expectedChildCount: 3 },
  );

  const renditions = ["240p", "720p", "4k"] as const;
  for (const rendition of renditions) {
    await enqueueVideoPipelineChildJob(ctx(2, `child:${rendition}`), {
      uploadId,
      parentRequestId: `${requestId}:parent`,
      parentJobId,
      rendition,
      shouldFail: false,
      attempts: 1,
      backoffDelayMs: 0,
      progressTtlSeconds: 90,
    });
  }

  for (const [routingKey, detail] of [
    ["video.cdn.ready", "cdn_publish"],
    ["video.search.index", "search_index"],
    ["video.notify.ready", "subscriber_notify"],
  ] as const) {
    await publishVideoPipelineMessage(ctx(4, `route:${detail}`), {
      uploadId,
      rendition: "720p",
      routingKey,
      detail,
    });
  }

  await produceKafkaEvent(
    ctx(4, "kafka:video_published"),
    `video.published:${uploadId}:completed=3:failed=0`,
    "video-pipeline-events",
  );

  await runVideoPipelineFinalize(ctx(5, "finalize"), {
    uploadId,
    renditionsCompleted: 3,
    renditionsFailed: 0,
    published: true,
    failureReason: null,
  });
}

// ── Banking ──────────────────────────────────────────────────────────────────

async function runBankingTrace(requestId: string): Promise<void> {
  const transferId = `trace-transfer-${requestId}`;
  const fromAccountId = "acct-checking-a";
  const toAccountId = "acct-savings-b";
  const amountCents = 5_000;
  const riskScore = 45; // below 72 → "approved" path (no hold)

  const ctx = (phase: number, suffix = "") => ({
    scenario: "trace-banking",
    phase,
    requestId: suffix ? `${requestId}:${suffix}` : requestId,
  });

  // Seed accounts so the transaction has valid balances
  await seedBankingAccounts(ctx(0, "bootstrap"), [
    { accountId: fromAccountId, balanceCents: 250_000 },
    { accountId: toAccountId, balanceCents: 180_000 },
  ]);

  emitSimulationEvent({
    scenario: "trace-banking",
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: { requestId, transferId, fromAccountId, toAccountId, amountCents },
    latencyMs: 0,
    description: `Transfer request received ${transferId}`,
    learnMore:
      "Elysia accepts the transfer request. Redis enforces rate limiting and idempotency before any money moves.",
  });

  await checkSlidingWindowRateLimit("trace:banking:rate", ctx(1), 1000, 7);

  const idempotencyKey = `trace:banking:idempotency:${transferId}`;
  await setRedisValueIfAbsent(idempotencyKey, requestId, 3600, ctx(1), "postgres");

  const fromLockKey = `trace:banking:lock:${fromAccountId}`;
  const toLockKey = `trace:banking:lock:${toAccountId}`;
  await setRedisValueIfAbsent(fromLockKey, requestId, 8, ctx(1), "postgres");
  await setRedisValueIfAbsent(toLockKey, requestId, 8, ctx(1), "postgres");

  await runBankingSerializableTransfer(ctx(2), {
    transferId,
    fromAccountId,
    toAccountId,
    amountCents,
  });

  const fraudDecision = await requestBankingFraudDecision(
    ctx(3, "fraud-check"),
    { transferId, amountCents, riskScore },
  );

  await updateBankingLedgerStatus(ctx(3), {
    transferId,
    ledgerStatus: fraudDecision === "approved" ? "approved" : "on_hold",
    fraudDecision,
  });

  const replicationDetails = [
    "ledger.posted",
    "replica.sync.node_1",
    "replica.sync.node_2",
  ] as const;

  for (const detail of replicationDetails) {
    await produceKafkaEvent(
      ctx(4, `kafka:${detail}`),
      `${detail}:transfer=${transferId}:status=approved`,
      "banking-ledger-events",
    );
  }

  await runBankingAuditRead(ctx(5, "audit"), transferId);

  // Release locks
  await deleteRedisKey(fromLockKey, ctx(1), "postgres");
  await deleteRedisKey(toLockKey, ctx(1), "postgres");
}

// ── Public API ───────────────────────────────────────────────────────────────

const scenarioLabels: Record<TraceScenarioId, string> = {
  "flash-sale": "Flash Sale",
  "ride-sharing": "Ride Sharing",
  "video-pipeline": "Video Pipeline",
  banking: "Banking",
};

const bootstrapByScenario: Record<
  TraceScenarioId,
  (requestId: string) => Promise<void>
> = {
  "flash-sale": async (requestId) => {
    await setRedisValue("trace:stock:item_42", "100", {
      scenario: "trace-flash-sale",
      phase: 0,
      requestId: `${requestId}:bootstrap`,
    });
  },
  "ride-sharing": async () => Promise.resolve(),
  "video-pipeline": async () => Promise.resolve(),
  banking: async () => Promise.resolve(),
};

const runnerByScenario: Record<
  TraceScenarioId,
  (requestId: string) => Promise<void>
> = {
  "flash-sale": runFlashSaleTrace,
  "ride-sharing": runRideSharingTrace,
  "video-pipeline": runVideoPipelineTrace,
  banking: runBankingTrace,
};

export async function runTrace(
  scenarioId: TraceScenarioId = "flash-sale",
): Promise<TraceResult> {
  const tag = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  const requestId = `trace-${tag}-${rand}`;
  const startedAt = Date.now();

  await bootstrapByScenario[scenarioId](requestId);

  const events = await captureTraceEvents(
    requestId,
    () => runnerByScenario[scenarioId](requestId),
    2500,
  );

  let cumulative = 0;
  const steps: TraceStep[] = events.map((event, index) => {
    cumulative += event.latencyMs;
    return { ...event, stepIndex: index, cumulativeLatencyMs: cumulative };
  });

  return {
    requestId,
    steps,
    totalLatencyMs: Date.now() - startedAt,
    startedAt,
    scenarioId,
    scenarioLabel: scenarioLabels[scenarioId],
  };
}

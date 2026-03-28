import { emitSimulationEvent, onSimulationEvent } from "../events/emitter";
import type { SimulationContext, SimulationEvent } from "../events/types";
import { enqueueBankingReviewJob } from "../services/bullmq";
import { produceKafkaEvent } from "../services/kafka";
import {
  runBankingAuditRead,
  runBankingSerializableTransfer,
  seedBankingAccounts,
  updateBankingLedgerStatus,
} from "../services/postgres";
import { requestBankingFraudDecision } from "../services/rabbitmq";
import {
  checkSlidingWindowRateLimit,
  deleteRedisKey,
  setRedisValueIfAbsent,
} from "../services/redis";

const scenarioName = "banking";
const kafkaTopic = "banking-ledger-events" as const;
const defaultTransferTarget = 18;
const transferIngestionIntervalMs = 1_150;
const rateLimitWindowMs = 1_000;
const rateLimitMaxRequests = 7;
const idempotencyTtlSeconds = 60 * 60 * 24;
const accountLockTtlSeconds = 8;
const reviewHoldSeconds = 12;

const accountSeedData = [
  { accountId: "acct-checking-a", balanceCents: 250_000 },
  { accountId: "acct-savings-b", balanceCents: 180_000 },
  { accountId: "acct-payroll-c", balanceCents: 220_000 },
  { accountId: "acct-vendor-d", balanceCents: 160_000 },
] as const;

type AccountId = (typeof accountSeedData)[number]["accountId"];

type BankingTransferRequest = {
  requestId: string;
  transferId: string;
  fromAccountId: AccountId;
  toAccountId: AccountId;
  amountCents: number;
  riskScore: number;
};

type PendingReview = {
  transfer: BankingTransferRequest;
  reviewRequestId: string;
};

type BankingScenarioStatus = {
  running: boolean;
  transferTarget: number;
  processedRequests: number;
  settledRequests: number;
  acceptedTransfers: number;
  completedTransfers: number;
  duplicateRejected: number;
  rateRejected: number;
  lockRejected: number;
  insufficientFunds: number;
  fraudHolds: number;
  reviewJobsQueued: number;
  reviewJobsCompleted: number;
  kafkaProduced: number;
  auditReads: number;
  currentPhase: number;
};

let running = false;
let transferTarget = defaultTransferTarget;
let processedRequests = 0;
let acceptedTransfers = 0;
let completedTransfers = 0;
let duplicateRejected = 0;
let rateRejected = 0;
let lockRejected = 0;
let insufficientFunds = 0;
let fraudHolds = 0;
let reviewJobsQueued = 0;
let reviewJobsCompleted = 0;
let kafkaProduced = 0;
let auditReads = 0;
let currentPhase = 0;
let ingestionBusy = false;
let forcedPhase: number | null = null;
let ingestionTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeFromBus: (() => void) | null = null;

const settledRequestIds = new Set<string>();
const completedTransferIds = new Set<string>();
const pendingReviewsByTransferId = new Map<string, PendingReview>();

function buildContext(requestId: string, phase: number): SimulationContext {
  return {
    scenario: scenarioName,
    phase,
    requestId,
  };
}

function parseStringData(event: SimulationEvent, key: string): string | null {
  const value = event.data[key];
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

function stopIngestionTimer(): void {
  if (!ingestionTimer) {
    return;
  }

  clearInterval(ingestionTimer);
  ingestionTimer = null;
}

function getRequestTransferId(index: number): string {
  if (index % 6 === 0) {
    return `transfer-${index - 1}`;
  }

  return `transfer-${index}`;
}

function getSeedAccount(index: number): {
  accountId: AccountId;
  balanceCents: number;
} {
  const account = accountSeedData[index];
  if (!account) {
    throw new Error(`missing_banking_seed_account:${index}`);
  }

  return {
    accountId: account.accountId,
    balanceCents: account.balanceCents,
  };
}

function buildTransferRequest(index: number): BankingTransferRequest {
  const fromIndex = (index - 1) % accountSeedData.length;
  const toIndex = (fromIndex + 1) % accountSeedData.length;

  const fromAccountId = getSeedAccount(fromIndex).accountId;
  const toAccountId = getSeedAccount(toIndex).accountId;

  const amountCents =
    index % 7 === 0 ? 300_000 : 2_400 + ((index * 415) % 2_800);
  const riskScore = index % 4 === 0 ? 83 : 48 + (index % 3) * 7;

  return {
    requestId: `banking-request-${index}`,
    transferId: getRequestTransferId(index),
    fromAccountId,
    toAccountId,
    amountCents,
    riskScore,
  };
}

async function maybeCompleteScenario(): Promise<void> {
  if (!running) {
    return;
  }

  if (processedRequests < transferTarget) {
    return;
  }

  if (settledRequestIds.size < processedRequests) {
    return;
  }

  if (pendingReviewsByTransferId.size > 0) {
    return;
  }

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 5,
    kind: "scenario.complete",
    source: "elysia",
    data: {
      transferTarget,
      processedRequests,
      settledRequests: settledRequestIds.size,
      acceptedTransfers,
      completedTransfers,
      duplicateRejected,
      rateRejected,
      lockRejected,
      insufficientFunds,
      fraudHolds,
      reviewJobsQueued,
      reviewJobsCompleted,
      kafkaProduced,
      auditReads,
    },
    latencyMs: 0,
    description: "Banking scenario complete",
  });

  running = false;
  ingestionBusy = false;
  forcedPhase = null;
  stopIngestionTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

async function markRequestSettled(requestId: string): Promise<void> {
  settledRequestIds.add(requestId);
  await maybeCompleteScenario();
}

async function finalizeApprovedTransfer(
  transfer: BankingTransferRequest,
  reviewOutcome: "approved" | "approved_after_review",
): Promise<void> {
  if (completedTransferIds.has(transfer.transferId)) {
    return;
  }

  completedTransferIds.add(transfer.transferId);
  completedTransfers += 1;

  emitPhaseChange(4, "Phase 4 activated: Kafka replicated ledger stream");

  const replicationEvents = [
    "ledger.posted",
    "replica.sync.node_1",
    "replica.sync.node_2",
    "replica.sync.node_3",
  ] as const;

  for (const detail of replicationEvents) {
    await produceKafkaEvent(
      buildContext(`${transfer.requestId}:kafka:${detail}`, 4),
      `${detail}:transfer=${transfer.transferId}:status=${reviewOutcome}`,
      kafkaTopic,
    );
    kafkaProduced += 1;
  }

  emitPhaseChange(5, "Phase 5 activated: audit read and backup stream");

  const auditResult = await runBankingAuditRead(
    buildContext(`${transfer.requestId}:audit`, 5),
    transfer.transferId,
  );
  auditReads += 1;

  await produceKafkaEvent(
    buildContext(`${transfer.requestId}:backup`, 5),
    `audit.backup:transfer=${transfer.transferId}:found=${auditResult.found}:ledger_status=${auditResult.ledgerStatus ?? "missing"}`,
    kafkaTopic,
  );
  kafkaProduced += 1;

  await markRequestSettled(transfer.requestId);
}

async function processTransferRequest(
  transfer: BankingTransferRequest,
): Promise<void> {
  const requestContext = buildContext(transfer.requestId, 1);

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: {
      requestId: transfer.requestId,
      transferId: transfer.transferId,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amountCents: transfer.amountCents,
    },
    latencyMs: 0,
    description: `Transfer request received ${transfer.transferId}`,
  });

  const rateLimit = await checkSlidingWindowRateLimit(
    "banking:rate-window",
    requestContext,
    rateLimitWindowMs,
    rateLimitMaxRequests,
  );

  if (!rateLimit.allowed) {
    rateRejected += 1;

    emitSimulationEvent({
      scenario: scenarioName,
      phase: 1,
      kind: "request.rejected",
      source: "elysia",
      target: "redis",
      data: {
        requestId: transfer.requestId,
        transferId: transfer.transferId,
        reason: "rate_limit",
        count: rateLimit.count,
      },
      latencyMs: 0,
      description: `Transfer ${transfer.transferId} rejected by rate limiter`,
    });

    await markRequestSettled(transfer.requestId);
    return;
  }

  const idempotencyKey = `banking:idempotency:${transfer.transferId}`;
  const idempotentApplied = await setRedisValueIfAbsent(
    idempotencyKey,
    transfer.requestId,
    idempotencyTtlSeconds,
    requestContext,
    "postgres",
  );

  if (!idempotentApplied) {
    duplicateRejected += 1;

    emitSimulationEvent({
      scenario: scenarioName,
      phase: 1,
      kind: "request.rejected",
      source: "elysia",
      target: "redis",
      data: {
        requestId: transfer.requestId,
        transferId: transfer.transferId,
        reason: "duplicate_request",
      },
      latencyMs: 0,
      description: `Duplicate transfer bounced by idempotency key ${transfer.transferId}`,
    });

    await markRequestSettled(transfer.requestId);
    return;
  }

  const fromLockKey = `banking:lock:${transfer.fromAccountId}`;
  const toLockKey = `banking:lock:${transfer.toAccountId}`;

  const fromLockApplied = await setRedisValueIfAbsent(
    fromLockKey,
    transfer.requestId,
    accountLockTtlSeconds,
    requestContext,
    "postgres",
  );
  const toLockApplied = await setRedisValueIfAbsent(
    toLockKey,
    transfer.requestId,
    accountLockTtlSeconds,
    requestContext,
    "postgres",
  );

  if (!fromLockApplied || !toLockApplied) {
    lockRejected += 1;

    if (fromLockApplied) {
      await deleteRedisKey(fromLockKey, requestContext, "postgres");
    }

    if (toLockApplied) {
      await deleteRedisKey(toLockKey, requestContext, "postgres");
    }

    await deleteRedisKey(idempotencyKey, requestContext, "postgres");

    emitSimulationEvent({
      scenario: scenarioName,
      phase: 1,
      kind: "request.rejected",
      source: "elysia",
      target: "redis",
      data: {
        requestId: transfer.requestId,
        transferId: transfer.transferId,
        reason: "account_lock_conflict",
      },
      latencyMs: 0,
      description: `Transfer ${transfer.transferId} rejected by account lock conflict`,
    });

    await markRequestSettled(transfer.requestId);
    return;
  }

  try {
    emitPhaseChange(
      2,
      "Phase 2 activated: PostgreSQL SERIALIZABLE ledger transaction",
    );

    acceptedTransfers += 1;

    const txResult = await runBankingSerializableTransfer(
      buildContext(transfer.requestId, 2),
      {
        transferId: transfer.transferId,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amountCents: transfer.amountCents,
      },
    );

    if (txResult.status === "insufficient_funds") {
      insufficientFunds += 1;

      emitSimulationEvent({
        scenario: scenarioName,
        phase: 2,
        kind: "request.rejected",
        source: "elysia",
        target: "postgres",
        data: {
          requestId: transfer.requestId,
          transferId: transfer.transferId,
          reason: "insufficient_funds",
          fromBalanceCents: txResult.fromBalanceCents,
          amountCents: transfer.amountCents,
        },
        latencyMs: 0,
        description: `Transfer ${transfer.transferId} rejected: insufficient funds`,
      });

      await markRequestSettled(transfer.requestId);
      return;
    }

    emitPhaseChange(3, "Phase 3 activated: fraud check and hold review");

    const decision = await requestBankingFraudDecision(
      buildContext(`${transfer.requestId}:fraud-check`, 3),
      {
        transferId: transfer.transferId,
        amountCents: transfer.amountCents,
        riskScore: transfer.riskScore,
      },
    );

    if (decision === "approved") {
      await updateBankingLedgerStatus(buildContext(transfer.requestId, 3), {
        transferId: transfer.transferId,
        ledgerStatus: "approved",
        fraudDecision: "approved",
      });

      await finalizeApprovedTransfer(transfer, "approved");
      return;
    }

    fraudHolds += 1;
    reviewJobsQueued += 1;

    await updateBankingLedgerStatus(buildContext(transfer.requestId, 3), {
      transferId: transfer.transferId,
      ledgerStatus: "on_hold",
      fraudDecision: "hold",
    });

    const reviewRequestId = `${transfer.requestId}:manual-review`;
    pendingReviewsByTransferId.set(transfer.transferId, {
      transfer,
      reviewRequestId,
    });

    await enqueueBankingReviewJob(buildContext(reviewRequestId, 3), {
      transferId: transfer.transferId,
      reason: "risk_threshold_exceeded",
      holdSeconds: reviewHoldSeconds,
      reviewDelayMs: 340,
    });
  } finally {
    await deleteRedisKey(fromLockKey, requestContext, "postgres");
    await deleteRedisKey(toLockKey, requestContext, "postgres");
  }
}

async function handleReviewCompletion(event: SimulationEvent): Promise<void> {
  if (event.kind !== "bullmq.job.completed") {
    return;
  }

  if (parseStringData(event, "workflow") !== "banking-review") {
    return;
  }

  const transferId = parseStringData(event, "transferId");
  if (!transferId) {
    return;
  }

  const pendingReview = pendingReviewsByTransferId.get(transferId);
  if (!pendingReview) {
    return;
  }

  pendingReviewsByTransferId.delete(transferId);
  reviewJobsCompleted += 1;

  await updateBankingLedgerStatus(
    buildContext(pendingReview.reviewRequestId, 3),
    {
      transferId,
      ledgerStatus: "approved_after_review",
      fraudDecision: "approved_after_review",
    },
  );

  await finalizeApprovedTransfer(
    pendingReview.transfer,
    "approved_after_review",
  );
}

async function handleReviewFailure(event: SimulationEvent): Promise<void> {
  if (event.kind !== "bullmq.job.failed") {
    return;
  }

  if (parseStringData(event, "workflow") !== "banking-review") {
    return;
  }

  if (event.data.finalFailure !== true) {
    return;
  }

  const transferId = parseStringData(event, "transferId");
  if (!transferId) {
    return;
  }

  const pendingReview = pendingReviewsByTransferId.get(transferId);
  if (!pendingReview) {
    return;
  }

  pendingReviewsByTransferId.delete(transferId);

  await updateBankingLedgerStatus(
    buildContext(pendingReview.reviewRequestId, 3),
    {
      transferId,
      ledgerStatus: "review_failed",
      fraudDecision: "review_failed",
    },
  );

  await markRequestSettled(pendingReview.transfer.requestId);
}

function registerEventHandlers(): void {
  unsubscribeFromBus = onSimulationEvent((event) => {
    if (!running || event.scenario !== scenarioName) {
      return;
    }

    if (event.kind === "bullmq.job.completed") {
      void handleReviewCompletion(event);
      return;
    }

    if (event.kind === "bullmq.job.failed") {
      void handleReviewFailure(event);
    }
  });
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

    if (processedRequests >= transferTarget) {
      stopIngestionTimer();
      await maybeCompleteScenario();
      return;
    }

    const transfer = buildTransferRequest(processedRequests + 1);
    processedRequests += 1;

    await processTransferRequest(transfer);

    if (processedRequests >= transferTarget) {
      stopIngestionTimer();
      await maybeCompleteScenario();
    }
  } finally {
    ingestionBusy = false;
  }
}

export async function startBankingScenario(): Promise<void> {
  if (running) {
    return;
  }

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }

  running = true;
  processedRequests = 0;
  acceptedTransfers = 0;
  completedTransfers = 0;
  duplicateRejected = 0;
  rateRejected = 0;
  lockRejected = 0;
  insufficientFunds = 0;
  fraudHolds = 0;
  reviewJobsQueued = 0;
  reviewJobsCompleted = 0;
  kafkaProduced = 0;
  auditReads = 0;
  currentPhase = 0;
  ingestionBusy = false;
  forcedPhase = null;

  settledRequestIds.clear();
  completedTransferIds.clear();
  pendingReviewsByTransferId.clear();

  await seedBankingAccounts(
    buildContext("banking-bootstrap", 1),
    accountSeedData.map((account) => ({
      accountId: account.accountId,
      balanceCents: account.balanceCents,
    })),
  );

  registerEventHandlers();
  emitPhaseChange(1, "Phase 1 activated: rate limit and idempotency gate");

  await runIngestionTick();

  ingestionTimer = setInterval(() => {
    void runIngestionTick();
  }, transferIngestionIntervalMs);
}

export async function stopBankingScenario(): Promise<void> {
  running = false;
  ingestionBusy = false;
  forcedPhase = null;

  stopIngestionTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }

  pendingReviewsByTransferId.clear();
}

export function isBankingScenarioRunning(): boolean {
  return running;
}

export function setBankingScenarioPhase(phase: number): void {
  if (phase < 1 || phase > 5) {
    return;
  }

  forcedPhase = phase;
}

export function setBankingTransferTarget(target: number): void {
  transferTarget = Math.max(1, Math.trunc(target));
}

export function getBankingStatus(): BankingScenarioStatus {
  return {
    running,
    transferTarget,
    processedRequests,
    settledRequests: settledRequestIds.size,
    acceptedTransfers,
    completedTransfers,
    duplicateRejected,
    rateRejected,
    lockRejected,
    insufficientFunds,
    fraudHolds,
    reviewJobsQueued,
    reviewJobsCompleted,
    kafkaProduced,
    auditReads,
    currentPhase,
  };
}

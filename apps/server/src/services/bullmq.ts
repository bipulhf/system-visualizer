import { Queue, Worker, type Job } from "bullmq";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const redisUrl = new URL(env.redisUrl);

type EventData = Record<string, string | number | boolean | null>;

type FlashSaleJobData = {
  scenario: string;
  phase: number;
  requestId: string;
  shouldFail: boolean;
  workflow: "flash-sale";
};

type RideDispatchJobData = {
  scenario: string;
  phase: number;
  requestId: string;
  workflow: "ride-dispatch";
  passengerId: string;
  candidateDriversCsv: string;
  attempt: number;
  searchRadiusKm: number;
  timeoutSeconds: number;
  forceRetry: boolean;
};

type RideDispatchResult = {
  selectedDriverId: string;
  passengerId: string;
};

const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || "6379"),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
};

const flashSaleQueueName = "visualizer-flash-sale-orders";
const rideDispatchQueueName = "visualizer-ride-sharing-dispatch";

const flashSaleQueue = new Queue<FlashSaleJobData>(flashSaleQueueName, {
  connection: redisConnection,
});

const rideDispatchQueue = new Queue<RideDispatchJobData>(
  rideDispatchQueueName,
  {
    connection: redisConnection,
  },
);

let flashSaleWorker: Worker<FlashSaleJobData> | null = null;
let rideDispatchWorker: Worker<RideDispatchJobData, RideDispatchResult> | null =
  null;

function emitBullMqEvent(
  job: Job<FlashSaleJobData> | Job<RideDispatchJobData>,
  kind:
    | "bullmq.job.processing"
    | "bullmq.job.completed"
    | "bullmq.job.failed"
    | "bullmq.job.progress",
  description: string,
  data: EventData,
): void {
  emitSimulationEvent({
    scenario: job.data.scenario,
    phase: job.data.phase,
    kind,
    source: "bullmq",
    target: "rabbitmq",
    data,
    latencyMs: 0,
    description,
  });
}

function ensureFlashSaleWorker(): void {
  if (flashSaleWorker) {
    return;
  }

  flashSaleWorker = new Worker<FlashSaleJobData>(
    flashSaleQueueName,
    async (job) => {
      emitBullMqEvent(
        job,
        "bullmq.job.processing",
        `Worker started ${job.id ?? "job"}`,
        {
          requestId: job.data.requestId,
          jobId: job.id ?? null,
          attemptsMade: job.attemptsMade,
        },
      );

      const steps = [
        { name: "payment", progress: 34 },
        { name: "reserve_inventory", progress: 67 },
        { name: "confirm", progress: 100 },
      ] as const;

      for (const step of steps) {
        await Bun.sleep(85);

        emitBullMqEvent(
          job,
          "bullmq.job.progress",
          `Job ${job.id ?? "job"} ${step.name}`,
          {
            requestId: job.data.requestId,
            jobId: job.id ?? null,
            step: step.name,
            progress: step.progress,
          },
        );
      }

      if (job.data.shouldFail) {
        throw new Error("simulated_worker_failure");
      }

      return { success: true };
    },
    {
      connection: redisConnection,
      concurrency: 12,
    },
  );

  flashSaleWorker.on("completed", (job) => {
    emitBullMqEvent(
      job,
      "bullmq.job.completed",
      `Job completed ${job.id ?? "job"}`,
      {
        requestId: job.data.requestId,
        jobId: job.id ?? null,
        attemptsMade: job.attemptsMade,
      },
    );
  });

  flashSaleWorker.on("failed", (job, error) => {
    if (!job) {
      return;
    }

    emitBullMqEvent(job, "bullmq.job.failed", `Job failed ${job.id ?? "job"}`, {
      requestId: job.data.requestId,
      jobId: job.id ?? null,
      reason: error.message,
      attemptsMade: job.attemptsMade,
      attemptsMax: job.opts.attempts ?? 1,
      finalFailure: job.attemptsMade >= (job.opts.attempts ?? 1),
    });
  });
}

function ensureRideDispatchWorker(): void {
  if (rideDispatchWorker) {
    return;
  }

  rideDispatchWorker = new Worker<RideDispatchJobData, RideDispatchResult>(
    rideDispatchQueueName,
    async (job) => {
      emitBullMqEvent(
        job,
        "bullmq.job.processing",
        `Dispatch worker started ${job.id ?? "job"}`,
        {
          requestId: job.data.requestId,
          passengerId: job.data.passengerId,
          jobId: job.id ?? null,
          attempt: job.data.attempt,
          searchRadiusKm: Number(job.data.searchRadiusKm.toFixed(2)),
        },
      );

      const countdownPoints = [30, 20, 10] as const;
      for (const remainingSeconds of countdownPoints) {
        await Bun.sleep(95);
        emitBullMqEvent(
          job,
          "bullmq.job.progress",
          `Dispatch timeout countdown ${remainingSeconds}s`,
          {
            requestId: job.data.requestId,
            passengerId: job.data.passengerId,
            jobId: job.id ?? null,
            step: "dispatch_timeout",
            timeRemainingSec: remainingSeconds,
            attempt: job.data.attempt,
          },
        );
      }

      const driverIds = job.data.candidateDriversCsv
        ? job.data.candidateDriversCsv.split(",")
        : [];

      if (job.data.forceRetry || driverIds.length === 0) {
        const reason = job.data.forceRetry
          ? "driver_response_timeout"
          : "no_driver_available";
        throw new Error(reason);
      }

      const selectedDriverId = driverIds[0];
      if (!selectedDriverId) {
        throw new Error("no_driver_available");
      }

      await Bun.sleep(60);

      return {
        selectedDriverId,
        passengerId: job.data.passengerId,
      };
    },
    {
      connection: redisConnection,
      concurrency: 6,
    },
  );

  rideDispatchWorker.on("completed", (job, result) => {
    emitBullMqEvent(
      job,
      "bullmq.job.completed",
      `Dispatch matched ${job.data.requestId}`,
      {
        requestId: job.data.requestId,
        passengerId: result.passengerId,
        selectedDriverId: result.selectedDriverId,
        jobId: job.id ?? null,
        attempt: job.data.attempt,
      },
    );
  });

  rideDispatchWorker.on("failed", (job, error) => {
    if (!job) {
      return;
    }

    emitBullMqEvent(
      job,
      "bullmq.job.failed",
      `Dispatch failed ${job.data.requestId}`,
      {
        requestId: job.data.requestId,
        passengerId: job.data.passengerId,
        jobId: job.id ?? null,
        reason: error.message,
        attempt: job.data.attempt,
        searchRadiusKm: Number(job.data.searchRadiusKm.toFixed(2)),
        finalFailure: true,
      },
    );
  });
}

export async function checkBullMqConnection(): Promise<void> {
  await flashSaleQueue.waitUntilReady();
  await rideDispatchQueue.waitUntilReady();
  ensureFlashSaleWorker();
  ensureRideDispatchWorker();
}

export async function enqueueBullMqJob(
  context: SimulationContext,
  options: {
    shouldFail: boolean;
    priority: number;
    attempts: number;
    backoffDelayMs: number;
  },
): Promise<string> {
  await flashSaleQueue.waitUntilReady();
  ensureFlashSaleWorker();

  const startedAt = performance.now();

  const job = await flashSaleQueue.add(
    "simulation-job",
    {
      scenario: context.scenario,
      phase: context.phase,
      requestId: context.requestId,
      shouldFail: options.shouldFail,
      workflow: "flash-sale",
    },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: options.attempts,
      priority: options.priority,
      backoff: {
        type: "exponential",
        delay: options.backoffDelayMs,
      },
    },
  );

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "bullmq.job.created",
    source: "bullmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      jobId: job.id ?? null,
      shouldFail: options.shouldFail,
      priority: options.priority,
      attempts: options.attempts,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `BullMQ created job ${job.id ?? "job"}`,
  });

  return job.id ? String(job.id) : context.requestId;
}

export async function enqueueRideDispatchJob(
  context: SimulationContext,
  options: {
    passengerId: string;
    candidateDriverIds: string[];
    attempt: number;
    searchRadiusKm: number;
    timeoutSeconds: number;
    forceRetry: boolean;
    retryDelayMs: number;
  },
): Promise<string> {
  await rideDispatchQueue.waitUntilReady();
  ensureRideDispatchWorker();

  const startedAt = performance.now();

  const job = await rideDispatchQueue.add(
    "ride-dispatch",
    {
      scenario: context.scenario,
      phase: context.phase,
      requestId: context.requestId,
      workflow: "ride-dispatch",
      passengerId: options.passengerId,
      candidateDriversCsv: options.candidateDriverIds.join(","),
      attempt: options.attempt,
      searchRadiusKm: options.searchRadiusKm,
      timeoutSeconds: options.timeoutSeconds,
      forceRetry: options.forceRetry,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
      delay: options.retryDelayMs,
      attempts: 1,
    },
  );

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "bullmq.job.created",
    source: "bullmq",
    target: "rabbitmq",
    data: {
      requestId: context.requestId,
      passengerId: options.passengerId,
      jobId: job.id ?? null,
      candidateCount: options.candidateDriverIds.length,
      attempt: options.attempt,
      searchRadiusKm: Number(options.searchRadiusKm.toFixed(2)),
      timeoutSeconds: options.timeoutSeconds,
      forceRetry: options.forceRetry,
      retryDelayMs: options.retryDelayMs,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `BullMQ created dispatch job ${job.id ?? "job"}`,
  });

  return job.id ? String(job.id) : context.requestId;
}

export async function closeBullMqConnection(): Promise<void> {
  if (flashSaleWorker) {
    await flashSaleWorker.close();
    flashSaleWorker = null;
  }

  if (rideDispatchWorker) {
    await rideDispatchWorker.close();
    rideDispatchWorker = null;
  }

  await flashSaleQueue.close();
  await rideDispatchQueue.close();
}

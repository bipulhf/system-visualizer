import { Queue, Worker, type Job } from "bullmq";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const redisUrl = new URL(env.redisUrl);

type SimulationJobData = {
  scenario: string;
  phase: number;
  requestId: string;
  shouldFail: boolean;
  workflow: "flash-sale";
};

const queueName = "visualizer-flash-sale-orders";

const queue = new Queue<SimulationJobData>(queueName, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || "6379"),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
  },
});

let worker: Worker<SimulationJobData> | null = null;

function emitJobEvent(
  job: Job<SimulationJobData>,
  kind:
    | "bullmq.job.processing"
    | "bullmq.job.completed"
    | "bullmq.job.failed"
    | "bullmq.job.progress",
  description: string,
  data: Record<string, string | number | boolean | null>,
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

function ensureBullMqWorker(): void {
  if (worker) {
    return;
  }

  worker = new Worker<SimulationJobData>(
    queueName,
    async (job) => {
      emitJobEvent(
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

        emitJobEvent(
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
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || "6379"),
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
      },
      concurrency: 12,
    },
  );

  worker.on("completed", (job) => {
    emitJobEvent(
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

  worker.on("failed", (job, error) => {
    if (!job) {
      return;
    }

    emitJobEvent(job, "bullmq.job.failed", `Job failed ${job.id ?? "job"}`, {
      requestId: job.data.requestId,
      jobId: job.id ?? null,
      reason: error.message,
      attemptsMade: job.attemptsMade,
      attemptsMax: job.opts.attempts ?? 1,
      finalFailure: job.attemptsMade >= (job.opts.attempts ?? 1),
    });
  });
}

export async function checkBullMqConnection(): Promise<void> {
  await queue.waitUntilReady();
  ensureBullMqWorker();
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
  await queue.waitUntilReady();
  ensureBullMqWorker();

  const startedAt = performance.now();

  const job = await queue.add(
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

export async function closeBullMqConnection(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }

  await queue.close();
}

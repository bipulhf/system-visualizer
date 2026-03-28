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
};

const queueName = "visualizer-phase1-simulation";

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
  kind: "bullmq.job.processing" | "bullmq.job.completed" | "bullmq.job.failed",
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
        },
      );

      await Bun.sleep(180);

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
    });
  });
}

export async function checkBullMqConnection(): Promise<void> {
  await queue.waitUntilReady();
  ensureBullMqWorker();
}

export async function enqueueBullMqJob(
  context: SimulationContext,
  shouldFail: boolean,
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
      shouldFail,
    },
    {
      removeOnComplete: 100,
      removeOnFail: 100,
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
      jobId: job.id ?? null,
      shouldFail,
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

import Redis from "ioredis";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

async function ensureRedisConnection(): Promise<void> {
  if (redis.status !== "ready") {
    await redis.connect();
  }
}

export async function checkRedisConnection(): Promise<void> {
  await ensureRedisConnection();

  await redis.ping();
}

export async function setRedisValue(
  key: string,
  value: string,
  context: SimulationContext,
): Promise<void> {
  const startedAt = performance.now();
  await ensureRedisConnection();
  await redis.set(key, value);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "redis.op",
    source: "redis",
    data: {
      operation: "SET",
      key,
      value,
      requestId: context.requestId,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `Redis SET ${key}`,
  });
}

export async function decrementRedisKey(
  key: string,
  context: SimulationContext,
): Promise<number> {
  const startedAt = performance.now();
  await ensureRedisConnection();
  const value = await redis.decr(key);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "redis.op",
    source: "redis",
    target: "bullmq",
    data: {
      operation: "DECR",
      key,
      value,
      requestId: context.requestId,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `Redis DECR ${key} -> ${value}`,
  });

  return value;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  await redis.quit();
}

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

export async function incrementRedisKey(
  key: string,
  context: SimulationContext,
): Promise<number> {
  const startedAt = performance.now();
  await ensureRedisConnection();
  const value = await redis.incr(key);

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "redis.op",
    source: "redis",
    target: "bullmq",
    data: {
      operation: "INCR",
      key,
      value,
      requestId: context.requestId,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `Redis INCR ${key} -> ${value}`,
  });

  return value;
}

export async function checkSlidingWindowRateLimit(
  key: string,
  context: SimulationContext,
  windowMs: number,
  maxRequests: number,
): Promise<{ allowed: boolean; count: number }> {
  const startedAt = performance.now();
  await ensureRedisConnection();

  const now = Date.now();
  const windowStart = now - windowMs;
  const member = `${context.requestId}:${now}`;

  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, member);
  pipeline.zcard(key);
  pipeline.pexpire(key, windowMs);
  const pipelineResult = await pipeline.exec();

  const countResult = pipelineResult?.[2]?.[1];
  const count = typeof countResult === "number" ? countResult : 0;
  const allowed = count <= maxRequests;

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "redis.op",
    source: "redis",
    data: {
      operation: "SLIDING_WINDOW",
      key,
      count,
      maxRequests,
      allowed,
      requestId: context.requestId,
    },
    latencyMs: Math.round(performance.now() - startedAt),
    description: `Redis rate-limit window count ${count}/${maxRequests}`,
  });

  return { allowed, count };
}

export async function closeRedisConnection(): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  await redis.quit();
}

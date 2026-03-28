import Redis from "ioredis";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

let redisConnectionPromise: Promise<void> | null = null;

async function ensureRedisConnection(): Promise<void> {
  if (redis.status === "ready") {
    return;
  }

  if (redisConnectionPromise) {
    await redisConnectionPromise;
    return;
  }

  redisConnectionPromise = redis
    .connect()
    .catch((error: Error) => {
      if (error.message.includes("already connecting/connected")) {
        return;
      }

      throw error;
    })
    .finally(() => {
      redisConnectionPromise = null;
    });

  await redisConnectionPromise;

  await redis.ping();
}

function emitRedisOperation(
  context: SimulationContext,
  data: Record<string, string | number | boolean | null>,
  description: string,
  target?: "bullmq" | "kafka",
  latencyMs: number = 0,
): void {
  const baseEvent = {
    scenario: context.scenario,
    phase: context.phase,
    kind: "redis.op",
    source: "redis",
    data,
    latencyMs,
    description,
  } as const;

  if (target) {
    emitSimulationEvent({
      ...baseEvent,
      target,
    });
    return;
  }

  emitSimulationEvent(baseEvent);
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

  emitRedisOperation(
    context,
    {
      operation: "SET",
      key,
      value,
      requestId: context.requestId,
    },
    `Redis SET ${key}`,
    undefined,
    Math.round(performance.now() - startedAt),
  );
}

export async function decrementRedisKey(
  key: string,
  context: SimulationContext,
): Promise<number> {
  const startedAt = performance.now();
  await ensureRedisConnection();
  const value = await redis.decr(key);

  emitRedisOperation(
    context,
    {
      operation: "DECR",
      key,
      value,
      requestId: context.requestId,
    },
    `Redis DECR ${key} -> ${value}`,
    "bullmq",
    Math.round(performance.now() - startedAt),
  );

  return value;
}

export async function incrementRedisKey(
  key: string,
  context: SimulationContext,
): Promise<number> {
  const startedAt = performance.now();
  await ensureRedisConnection();
  const value = await redis.incr(key);

  emitRedisOperation(
    context,
    {
      operation: "INCR",
      key,
      value,
      requestId: context.requestId,
    },
    `Redis INCR ${key} -> ${value}`,
    "bullmq",
    Math.round(performance.now() - startedAt),
  );

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

  emitRedisOperation(
    context,
    {
      operation: "SLIDING_WINDOW",
      key,
      count,
      maxRequests,
      allowed,
      requestId: context.requestId,
    },
    `Redis rate-limit window count ${count}/${maxRequests}`,
    undefined,
    Math.round(performance.now() - startedAt),
  );

  return { allowed, count };
}

export async function geoAddDriverLocation(
  key: string,
  driverId: string,
  longitude: number,
  latitude: number,
  heartbeatTtlSeconds: number,
  context: SimulationContext,
): Promise<void> {
  const startedAt = performance.now();
  await ensureRedisConnection();

  await redis.geoadd(key, longitude, latitude, driverId);
  await redis.set(
    `${key}:heartbeat:${driverId}`,
    String(Date.now()),
    "EX",
    heartbeatTtlSeconds,
  );

  emitRedisOperation(
    context,
    {
      operation: "GEOADD",
      key,
      driverId,
      longitude: Number(longitude.toFixed(6)),
      latitude: Number(latitude.toFixed(6)),
      ttlSeconds: heartbeatTtlSeconds,
      requestId: context.requestId,
    },
    `Redis GEOADD ${driverId}`,
    "bullmq",
    Math.round(performance.now() - startedAt),
  );
}

export async function geoSearchNearbyDrivers(
  key: string,
  longitude: number,
  latitude: number,
  radiusKm: number,
  maxResults: number,
  context: SimulationContext,
): Promise<string[]> {
  const startedAt = performance.now();
  await ensureRedisConnection();

  const rawDriverIds = await redis.geosearch(
    key,
    "FROMLONLAT",
    longitude,
    latitude,
    "BYRADIUS",
    radiusKm,
    "km",
    "ASC",
    "COUNT",
    maxResults,
  );

  const driverIds: string[] = rawDriverIds.filter(
    (value): value is string => typeof value === "string",
  );

  emitRedisOperation(
    context,
    {
      operation: "GEOSEARCH",
      key,
      longitude: Number(longitude.toFixed(6)),
      latitude: Number(latitude.toFixed(6)),
      radiusKm: Number(radiusKm.toFixed(2)),
      maxResults,
      matched: driverIds.length,
      requestId: context.requestId,
    },
    `Redis GEOSEARCH matched ${driverIds.length} drivers`,
    "bullmq",
    Math.round(performance.now() - startedAt),
  );

  return driverIds;
}

export async function publishRedisMessage(
  channel: string,
  payload: string,
  context: SimulationContext,
): Promise<number> {
  const startedAt = performance.now();
  await ensureRedisConnection();
  const subscribers = await redis.publish(channel, payload);

  emitRedisOperation(
    context,
    {
      operation: "PUBLISH",
      channel,
      subscribers,
      payloadSize: payload.length,
      requestId: context.requestId,
    },
    `Redis PUBLISH ${channel}`,
    "kafka",
    Math.round(performance.now() - startedAt),
  );

  return subscribers;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  await redis.quit();
}

import Redis from "ioredis";
import { env } from "./env";

const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

export async function checkRedisConnection(): Promise<void> {
  if (redis.status !== "ready") {
    await redis.connect();
  }

  await redis.ping();
}

export async function closeRedisConnection(): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  await redis.quit();
}

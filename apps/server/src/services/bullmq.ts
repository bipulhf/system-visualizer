import { Queue } from "bullmq";
import { env } from "./env";

const redisUrl = new URL(env.redisUrl);
const queue = new Queue("visualizer-phase0", {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || "6379"),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
  },
});

export async function checkBullMqConnection(): Promise<void> {
  await queue.waitUntilReady();
}

export async function closeBullMqConnection(): Promise<void> {
  await queue.close();
}

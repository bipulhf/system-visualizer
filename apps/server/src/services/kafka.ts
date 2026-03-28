import { Kafka } from "kafkajs";
import { env } from "./env";

const kafka = new Kafka({
  brokers: env.kafkaBrokers,
  clientId: "visualizer-phase0-health",
});

export async function checkKafkaConnection(): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  await admin.listTopics();
  await admin.disconnect();
}

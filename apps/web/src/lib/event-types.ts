export const serviceNames = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
] as const;

export type ServiceName = (typeof serviceNames)[number];

export const eventKinds = [
  "request.received",
  "request.rejected",
  "redis.op",
  "bullmq.job.created",
  "bullmq.job.processing",
  "bullmq.job.completed",
  "bullmq.job.failed",
  "bullmq.job.dlq",
  "bullmq.job.progress",
  "rabbitmq.published",
  "rabbitmq.routed",
  "rabbitmq.consumed",
  "rabbitmq.ack",
  "kafka.produced",
  "kafka.consumed",
  "postgres.query",
  "postgres.tx.begin",
  "postgres.tx.commit",
  "phase.change",
  "scenario.complete",
] as const;

export type EventKind = (typeof eventKinds)[number];

export type EventDataValue = string | number | boolean | null;

export interface SimulationEvent {
  id: string;
  timestamp: number;
  scenario: string;
  phase: number;
  kind: EventKind;
  source: ServiceName;
  target?: ServiceName;
  data: Record<string, EventDataValue>;
  latencyMs: number;
  description: string;
  learnMore?: string;
}

export function isServiceName(value: string): value is ServiceName {
  return serviceNames.includes(value as ServiceName);
}

export function isEventKind(value: string): value is EventKind {
  return eventKinds.includes(value as EventKind);
}

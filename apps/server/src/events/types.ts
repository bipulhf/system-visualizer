export type ServiceName =
  | "elysia"
  | "redis"
  | "bullmq"
  | "rabbitmq"
  | "kafka"
  | "postgres";

export type EventKind =
  | "request.received"
  | "request.rejected"
  | "redis.op"
  | "bullmq.job.created"
  | "bullmq.job.processing"
  | "bullmq.job.completed"
  | "bullmq.job.failed"
  | "bullmq.job.dlq"
  | "bullmq.job.progress"
  | "rabbitmq.published"
  | "rabbitmq.routed"
  | "rabbitmq.consumed"
  | "rabbitmq.ack"
  | "kafka.produced"
  | "kafka.consumed"
  | "postgres.query"
  | "postgres.tx.begin"
  | "postgres.tx.commit"
  | "phase.change"
  | "scenario.complete";

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

export type SimulationEventInput = Omit<SimulationEvent, "id" | "timestamp">;

export interface SimulationContext {
  scenario: string;
  phase: number;
  requestId: string;
}

export type TraceStep = SimulationEvent & {
  stepIndex: number;
  cumulativeLatencyMs: number;
};

export interface TraceResult {
  requestId: string;
  steps: TraceStep[];
  totalLatencyMs: number;
  startedAt: number;
  scenarioId: string;
  scenarioLabel: string;
}

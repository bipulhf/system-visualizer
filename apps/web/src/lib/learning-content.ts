import type { EventKind, ServiceName } from "~/lib/event-types";

export type ScenarioPhase = {
  id: number;
  title: string;
  description: string;
  services: ServiceName[];
};

export type WhyTechEntry = {
  service: ServiceName;
  title: string;
  reason: string;
  comparison: string;
  keyMetric: string;
};

export type ConceptDefinition = {
  id: string;
  title: string;
  description: string;
  triggerKinds: EventKind[];
};

export type WhatIfEntry = {
  service: ServiceName;
  failureMode: string;
  explanation: string;
};

export const flashSalePhases: ScenarioPhase[] = [
  {
    id: 1,
    title: "The Spike",
    description: "Requests surge into the API and inventory checks begin.",
    services: ["elysia", "redis"],
  },
  {
    id: 2,
    title: "Job Queuing",
    description: "Accepted requests become resilient background jobs.",
    services: ["bullmq"],
  },
  {
    id: 3,
    title: "Fan-Out",
    description: "Messages fan out to downstream processors.",
    services: ["rabbitmq", "kafka"],
  },
  {
    id: 4,
    title: "Audit Trail",
    description: "Events are persisted for traceability and analytics.",
    services: ["postgres", "kafka"],
  },
];

export const whyTechByService: Record<ServiceName, WhyTechEntry> = {
  elysia: {
    service: "elysia",
    title: "Elysia as API Gateway",
    reason:
      "Elysia handles bursty request intake with low overhead while keeping route logic explicit.",
    comparison:
      "A heavier framework adds overhead during spikes and slows response fan-out.",
    keyMetric: "Fast request admission under heavy concurrency",
  },
  redis: {
    service: "redis",
    title: "Redis for Atomic Stock",
    reason:
      "Atomic DECR prevents overselling under race conditions without expensive locking.",
    comparison:
      "Row-level database locking increases latency and deadlock risk during flash loads.",
    keyMetric: "Sub-millisecond atomic counter operations",
  },
  bullmq: {
    service: "bullmq",
    title: "BullMQ for Reliable Jobs",
    reason:
      "Queue-backed workers isolate retries and backoff policies from request latency.",
    comparison:
      "Inline retries block requests and cascade failures across the API tier.",
    keyMetric: "Controlled retries with durable job state",
  },
  rabbitmq: {
    service: "rabbitmq",
    title: "RabbitMQ for Fan-Out",
    reason:
      "Publish once and route to many consumers without coupling producers to each consumer.",
    comparison:
      "Sequential service calls increase tail latency and create brittle chains.",
    keyMetric: "Independent downstream consumers with ACK visibility",
  },
  kafka: {
    service: "kafka",
    title: "Kafka for Event History",
    reason:
      "Immutable event logs let multiple consumer groups replay and analyze independently.",
    comparison:
      "Direct writes to one store lose replayability and consumer decoupling.",
    keyMetric: "Durable ordered event stream for multiple readers",
  },
  postgres: {
    service: "postgres",
    title: "PostgreSQL for Durable State",
    reason:
      "Transactions provide strong consistency for final order writes and audit records.",
    comparison:
      "Eventually-consistent stores can drift from financial truth under failure.",
    keyMetric: "ACID guarantees for critical writes",
  },
};

export const conceptDefinitions: ConceptDefinition[] = [
  {
    id: "atomic-operation",
    title: "Atomic Operation",
    description:
      "A single indivisible update prevents race conditions when thousands of requests compete.",
    triggerKinds: ["redis.op"],
  },
  {
    id: "dead-letter-queue",
    title: "Dead Letter Queue",
    description:
      "Failed jobs are isolated to preserve throughput while operators inspect bad payloads.",
    triggerKinds: ["bullmq.job.failed", "bullmq.job.dlq"],
  },
  {
    id: "fan-out-pattern",
    title: "Fan-Out Pattern",
    description:
      "One published message reaches many independent consumers through exchange routing.",
    triggerKinds: ["rabbitmq.published", "rabbitmq.routed"],
  },
  {
    id: "event-sourcing",
    title: "Event Sourcing",
    description:
      "State can be reconstructed by replaying ordered domain events from the log.",
    triggerKinds: ["kafka.produced", "kafka.consumed"],
  },
];

export const whatIfByService: Record<ServiceName, WhatIfEntry> = {
  elysia: {
    service: "elysia",
    failureMode: "Request backlog explosion",
    explanation:
      "Without a fast intake layer, requests queue at the edge and users hit timeouts before work starts.",
  },
  redis: {
    service: "redis",
    failureMode: "Oversold inventory",
    explanation:
      "Without atomic counters, parallel requests can each think stock is available and oversell items.",
  },
  bullmq: {
    service: "bullmq",
    failureMode: "Retry storm",
    explanation:
      "Without durable jobs, failures retry in request threads and amplify latency across services.",
  },
  rabbitmq: {
    service: "rabbitmq",
    failureMode: "Downstream bottleneck",
    explanation:
      "Without fan-out routing, producers call each downstream service sequentially and throughput collapses.",
  },
  kafka: {
    service: "kafka",
    failureMode: "Lost replayability",
    explanation:
      "Without an immutable stream, recovery and analytics cannot replay exact production history.",
  },
  postgres: {
    service: "postgres",
    failureMode: "Inconsistent financial state",
    explanation:
      "Without transaction guarantees, partial writes can commit and break audit integrity.",
  },
};

export const learnMoreByEventKind: Record<EventKind, string> = {
  "request.received": "The API accepted the request and started the workflow.",
  "request.rejected":
    "Admission controls rejected the request to protect system stability.",
  "redis.op":
    "Redis processed a fast atomic operation used for real-time coordination.",
  "bullmq.job.created":
    "A durable job was enqueued for asynchronous processing.",
  "bullmq.job.processing":
    "A worker picked up the queued job and started execution.",
  "bullmq.job.completed": "The background task finished successfully.",
  "bullmq.job.failed":
    "The job failed and can be retried or moved to DLQ depending on policy.",
  "bullmq.job.dlq":
    "The job reached the dead-letter queue for manual inspection.",
  "bullmq.job.progress":
    "The worker reported intermediate progress for this task.",
  "rabbitmq.published": "The producer published a message to the exchange.",
  "rabbitmq.routed":
    "Exchange bindings routed the message to one or more queues.",
  "rabbitmq.consumed": "A consumer read a message from its queue.",
  "rabbitmq.ack": "The consumer acknowledged successful processing.",
  "kafka.produced": "An event was appended to the Kafka topic partition.",
  "kafka.consumed": "A consumer group processed the event from the log.",
  "postgres.query": "A SQL query executed as part of transactional work.",
  "postgres.tx.begin": "A database transaction started.",
  "postgres.tx.commit": "The transaction committed durable changes.",
  "phase.change": "The scenario transitioned to a new teaching phase.",
  "scenario.complete": "The scenario completed a full instructional cycle.",
};

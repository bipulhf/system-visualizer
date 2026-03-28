import type { EventKind, ServiceName } from "~/lib/event-types";

export type SupportedScenarioId =
  | "flash-sale"
  | "ride-sharing"
  | "video-pipeline";

export type ScenarioInfo = {
  title: string;
  tagline: string;
  problem: string;
};

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

type ScenarioLearningContent = {
  phases: ScenarioPhase[];
  whyTechByService: Record<ServiceName, WhyTechEntry>;
  conceptDefinitions: ConceptDefinition[];
  whatIfByService: Record<ServiceName, WhatIfEntry>;
};

export const scenarioInfoById: Record<SupportedScenarioId, ScenarioInfo> = {
  "flash-sale": {
    title: "E-Commerce Flash Sale",
    tagline:
      "Understand how distributed services cooperate in a high-pressure flash sale.",
    problem:
      "Ten thousand customers attempt to buy one hundred items in seconds.",
  },
  "ride-sharing": {
    title: "Ride-Sharing Dispatch",
    tagline:
      "Match passengers with nearby drivers while keeping dispatch latency predictable.",
    problem:
      "Drivers move constantly and each ride request must find, lock, and confirm one driver quickly.",
  },
  "video-pipeline": {
    title: "Video Transcoding Pipeline",
    tagline:
      "Coordinate parent-child jobs, failure isolation, and publish readiness fan-out.",
    problem:
      "Each upload must fan out into multiple renditions while surviving partial failure and preserving final consistency.",
  },
};

export const scenarioLearningContent: Record<
  SupportedScenarioId,
  ScenarioLearningContent
> = {
  "flash-sale": {
    phases: [
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
    ],
    whyTechByService: {
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
          "Atomic DECR preserves inventory correctness when thousands of buyers hit the same item at once.",
        comparison:
          "Database row locks serialize traffic and can deadlock under burst contention.",
        keyMetric: "Atomic inventory decrement in sub-millisecond latency",
      },
      bullmq: {
        service: "bullmq",
        title: "BullMQ for Reliable Jobs",
        reason:
          "Retrying payment and reservation steps in workers protects API latency and keeps failures recoverable.",
        comparison:
          "Manual retries in request handlers increase timeout rates and duplicate work.",
        keyMetric: "Three-attempt exponential backoff with durable job state",
      },
      rabbitmq: {
        service: "rabbitmq",
        title: "RabbitMQ for Fan-Out",
        reason:
          "One order event fans out to email, invoice, warehouse, and fraud services independently.",
        comparison:
          "Sequential API calls couple all downstream services and amplify failures.",
        keyMetric:
          "Single publish, four routed queues with per-queue ACK visibility",
      },
      kafka: {
        service: "kafka",
        title: "Kafka for Event History",
        reason:
          "Every request outcome is appended once and replayed by analytics, notifications, and fraud groups.",
        comparison:
          "Single-sink writes cannot be replayed for new consumers without backfilling.",
        keyMetric:
          "10k immutable request outcomes consumed by three independent groups",
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
    },
    conceptDefinitions: [
      {
        id: "thundering-herd",
        title: "Thundering Herd",
        description:
          "A sudden burst of identical requests can overwhelm downstream systems unless admission controls and queues absorb pressure.",
        triggerKinds: ["request.rejected"],
      },
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
    ],
    whatIfByService: {
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
    },
  },
  "ride-sharing": {
    phases: [
      {
        id: 1,
        title: "Driver Heartbeat",
        description:
          "Drivers continuously report their location with expiring presence records.",
        services: ["elysia", "redis"],
      },
      {
        id: 2,
        title: "Ride Request",
        description:
          "The system finds nearby drivers and dispatches a timeout-protected job.",
        services: ["redis", "bullmq"],
      },
      {
        id: 3,
        title: "Driver Acceptance",
        description:
          "A direct exchange feeds competing consumers where only one wins the dispatch.",
        services: ["rabbitmq"],
      },
      {
        id: 4,
        title: "Trip Lifecycle",
        description:
          "Trip state transitions stream through Kafka and finalize in PostgreSQL.",
        services: ["kafka", "postgres"],
      },
    ],
    whyTechByService: {
      elysia: {
        service: "elysia",
        title: "Elysia for Fast Dispatch Intake",
        reason:
          "Low-overhead request handling keeps heartbeat and rider traffic responsive under continuous load.",
        comparison:
          "Blocking handlers raise p95 dispatch latency during peak commute traffic.",
        keyMetric:
          "Low admission overhead under mixed heartbeat and ride traffic",
      },
      redis: {
        service: "redis",
        title: "Redis Geo + TTL Presence",
        reason:
          "Geo indexing and expiring heartbeat keys keep only live drivers eligible for matching.",
        comparison:
          "A relational geo scan with manual expiry cleanup adds latency and stale-driver risk.",
        keyMetric:
          "Nearest-driver lookups in milliseconds with auto-expiring presence",
      },
      bullmq: {
        service: "bullmq",
        title: "BullMQ for Dispatch Timeouts",
        reason:
          "Dispatch attempts run asynchronously with timeout visualization and delayed retry radius expansion.",
        comparison:
          "Inline timeout loops block API threads and make retries hard to coordinate.",
        keyMetric:
          "Deterministic retry path with delayed second-attempt dispatch",
      },
      rabbitmq: {
        service: "rabbitmq",
        title: "RabbitMQ Competing Consumers",
        reason:
          "One queue with multiple consumers ensures exactly one dispatcher claims each ride.",
        comparison:
          "Broadcasting to all dispatchers creates duplicate assignment races.",
        keyMetric: "Single-consumer selection with explicit ACK handoff",
      },
      kafka: {
        service: "kafka",
        title: "Kafka for Trip State Machine",
        reason:
          "Trip transitions become an immutable stream that different teams consume at independent speeds.",
        comparison:
          "Single-table status updates lose transition history and replayability.",
        keyMetric: "Ordered lifecycle events consumed by three consumer groups",
      },
      postgres: {
        service: "postgres",
        title: "PostgreSQL for Final Trip Ledger",
        reason:
          "Completion writes provide a durable, queryable source of financial and operational truth.",
        comparison:
          "Keeping final state only in cache or stream memory is not audit-safe.",
        keyMetric: "Transactional trip completion persistence",
      },
    },
    conceptDefinitions: [
      {
        id: "geo-hashing",
        title: "Geo Hashing",
        description:
          "Geo indexes partition spatial data so nearest-neighbor lookups stay fast as driver count grows.",
        triggerKinds: ["redis.op"],
      },
      {
        id: "ttl-auto-expiry",
        title: "TTL Auto-Expiry",
        description:
          "Presence keys expire automatically so stale drivers disappear without cleanup jobs.",
        triggerKinds: ["redis.op"],
      },
      {
        id: "competing-consumers",
        title: "Competing Consumers",
        description:
          "Multiple workers consume from one queue and only one consumer processes each dispatch.",
        triggerKinds: ["rabbitmq.consumed", "rabbitmq.ack"],
      },
      {
        id: "state-machine",
        title: "State Machine",
        description:
          "Trips move through ordered lifecycle states, making behavior explicit and observable.",
        triggerKinds: ["kafka.produced", "kafka.consumed"],
      },
    ],
    whatIfByService: {
      elysia: {
        service: "elysia",
        failureMode: "Dispatch jitter under burst",
        explanation:
          "Slower intake causes heartbeat lag and stale location decisions during rider spikes.",
      },
      redis: {
        service: "redis",
        failureMode: "Stale or distant driver matches",
        explanation:
          "Without geo index and TTL presence, dispatch can pick drivers that are offline or too far away.",
      },
      bullmq: {
        service: "bullmq",
        failureMode: "Unbounded dispatch waits",
        explanation:
          "Without timeout jobs and delayed retries, requests can hang and starve new riders.",
      },
      rabbitmq: {
        service: "rabbitmq",
        failureMode: "Double-dispatch race",
        explanation:
          "Without a competing-consumer queue, multiple dispatchers can claim the same ride.",
      },
      kafka: {
        service: "kafka",
        failureMode: "Missing lifecycle trace",
        explanation:
          "Without immutable trip events, support teams cannot replay why a dispatch went wrong.",
      },
      postgres: {
        service: "postgres",
        failureMode: "No durable completion ledger",
        explanation:
          "If final trip state is not persisted transactionally, billing and reconciliation drift.",
      },
    },
  },
  "video-pipeline": {
    phases: [
      {
        id: 1,
        title: "Upload Intake",
        description:
          "An upload is admitted and persisted before orchestration begins.",
        services: ["elysia", "postgres", "bullmq"],
      },
      {
        id: 2,
        title: "Child Transcodes",
        description:
          "Parent and child jobs execute in parallel while progress is tracked in Redis.",
        services: ["bullmq", "redis"],
      },
      {
        id: 3,
        title: "Failure Isolation",
        description:
          "A failing rendition retries, then moves to DLQ without blocking healthy renditions.",
        services: ["bullmq", "redis"],
      },
      {
        id: 4,
        title: "Publish Routing",
        description:
          "Completion events route to downstream services and stream into Kafka.",
        services: ["rabbitmq", "kafka"],
      },
      {
        id: 5,
        title: "Finalize & Cleanup",
        description:
          "Final state commits to PostgreSQL and transient Redis progress keys are cleared.",
        services: ["postgres", "redis"],
      },
    ],
    whyTechByService: {
      elysia: {
        service: "elysia",
        title: "Elysia for Upload Admission",
        reason:
          "A lightweight edge API accepts uploads quickly and hands work to background systems.",
        comparison:
          "Synchronous upload-to-transcode handlers inflate response time and cause client retries.",
        keyMetric: "Low-overhead request intake before async orchestration",
      },
      redis: {
        service: "redis",
        title: "Redis for Live Progress State",
        reason:
          "Progress values with TTL provide fresh worker state while automatically expiring stale entries.",
        comparison:
          "Persistent tables for high-frequency progress updates increase write amplification and cleanup cost.",
        keyMetric:
          "Low-latency progress writes with TTL-based automatic expiry",
      },
      bullmq: {
        service: "bullmq",
        title: "BullMQ Parent-Child Orchestration",
        reason:
          "Parent and child job modeling keeps parallel transcoding explicit, retryable, and observable.",
        comparison:
          "Ad-hoc async workers make dependency tracking and targeted retries hard to reason about.",
        keyMetric: "Parallel child execution with bounded retries and DLQ path",
      },
      rabbitmq: {
        service: "rabbitmq",
        title: "RabbitMQ Topic Routing Keys",
        reason:
          "Routing keys fan out readiness events only to interested downstream consumers.",
        comparison:
          "Broadcasting all events to every consumer wastes compute and increases coupling.",
        keyMetric: "Selective multi-queue fan-out by routing key",
      },
      kafka: {
        service: "kafka",
        title: "Kafka for Publish Timeline",
        reason:
          "A durable event stream captures publish lifecycle and supports independent replay by multiple teams.",
        comparison:
          "Single destination notifications cannot be replayed reliably for new consumers.",
        keyMetric: "Immutable publish event log across multiple consumer groups",
      },
      postgres: {
        service: "postgres",
        title: "PostgreSQL for Final Asset Ledger",
        reason:
          "Finalized rendition counts and publish status require transactional durability for reconciliation.",
        comparison:
          "Keeping final state only in queues and cache makes billing and audit reconciliation fragile.",
        keyMetric: "Transactional finalization of durable asset state",
      },
    },
    conceptDefinitions: [
      {
        id: "parent-child-jobs",
        title: "Parent/Child Jobs",
        description:
          "A parent tracks orchestration while child jobs run independent transcode tasks in parallel.",
        triggerKinds: ["bullmq.job.created", "bullmq.job.processing"],
      },
      {
        id: "dead-letter-queue-video",
        title: "Dead Letter Queue",
        description:
          "After retries are exhausted, failed children move aside so healthy work can continue.",
        triggerKinds: ["bullmq.job.failed", "bullmq.job.dlq"],
      },
      {
        id: "routing-keys",
        title: "Routing Keys",
        description:
          "Topic routing keys send one publish event to exactly the queues that need it.",
        triggerKinds: ["rabbitmq.published", "rabbitmq.routed"],
      },
      {
        id: "partial-availability",
        title: "Partial Availability",
        description:
          "A system can still deliver value even when one rendition fails, as long as failures are isolated.",
        triggerKinds: ["scenario.complete", "postgres.tx.commit"],
      },
    ],
    whatIfByService: {
      elysia: {
        service: "elysia",
        failureMode: "Slow upload admission",
        explanation:
          "Without a fast intake boundary, uploads queue at the edge and user retries multiply pressure.",
      },
      redis: {
        service: "redis",
        failureMode: "Stale progress state",
        explanation:
          "Without TTL-backed progress keys, dashboards display stale values and operators lose confidence.",
      },
      bullmq: {
        service: "bullmq",
        failureMode: "Opaque orchestration",
        explanation:
          "Without parent-child queues, retry policy and failure isolation become ad-hoc and fragile.",
      },
      rabbitmq: {
        service: "rabbitmq",
        failureMode: "Over-broadcasted events",
        explanation:
          "Without routing keys, unrelated services process irrelevant publish events and waste capacity.",
      },
      kafka: {
        service: "kafka",
        failureMode: "No replayable publish history",
        explanation:
          "Without a durable stream, late-joining analytics cannot reconstruct publication outcomes.",
      },
      postgres: {
        service: "postgres",
        failureMode: "Missing final source of truth",
        explanation:
          "Without final transactional writes, reporting and reconciliation drift from actual pipeline outcomes.",
      },
    },
  },
};

export function getScenarioLearningContent(
  scenarioId: SupportedScenarioId,
): ScenarioLearningContent {
  return scenarioLearningContent[scenarioId];
}

export const flashSalePhases = scenarioLearningContent["flash-sale"].phases;
export const whyTechByService =
  scenarioLearningContent["flash-sale"].whyTechByService;
export const conceptDefinitions =
  scenarioLearningContent["flash-sale"].conceptDefinitions;
export const whatIfByService =
  scenarioLearningContent["flash-sale"].whatIfByService;

export const learnMoreByEventKind: Record<EventKind, string> = {
  "request.received":
    "A request entered the workflow and started coordination.",
  "request.rejected":
    "Admission or retry policy rejected this request to protect system stability.",
  "redis.op":
    "Redis handled a low-latency coordination operation for counters, geo, TTL, or pub/sub.",
  "bullmq.job.created": "A durable background task was queued.",
  "bullmq.job.processing": "A worker started processing the queued task.",
  "bullmq.job.completed": "The worker finished the task successfully.",
  "bullmq.job.failed":
    "The task failed and may retry or be rejected based on policy.",
  "bullmq.job.dlq": "The task moved to a dead-letter path for inspection.",
  "bullmq.job.progress": "The worker reported intermediate progress.",
  "rabbitmq.published": "A producer published a message to RabbitMQ.",
  "rabbitmq.routed": "Exchange bindings routed the message to its queue path.",
  "rabbitmq.consumed": "A consumer accepted the message for processing.",
  "rabbitmq.ack": "The consumer acknowledged successful handling.",
  "kafka.produced": "An event was appended to a Kafka topic partition.",
  "kafka.consumed": "A consumer group processed the event from the log.",
  "postgres.query": "A SQL statement executed as part of persistence work.",
  "postgres.tx.begin": "A transactional write sequence started.",
  "postgres.tx.commit": "The transaction committed durable state.",
  "phase.change": "The simulation advanced to the next instructional phase.",
  "scenario.complete": "The scenario completed its full workflow.",
};

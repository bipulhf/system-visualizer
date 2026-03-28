import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { AnimatedEdgeData } from "~/components/flow/animated-edge";
import type {
  ServiceNodeData,
  ServiceStatus,
} from "~/components/flow/service-node";
import type { ServiceName, SimulationEvent } from "~/lib/event-types";
import type { SupportedScenarioId } from "~/lib/learning-content";
import { serviceNames } from "~/lib/event-types";

const serviceLabels: Record<ServiceName, string> = {
  elysia: "Elysia API",
  redis: "Redis",
  bullmq: "BullMQ",
  rabbitmq: "RabbitMQ",
  kafka: "Kafka",
  postgres: "PostgreSQL",
};

const serviceColorVars: Record<ServiceName, string> = {
  elysia: "--main",
  redis: "--redis",
  bullmq: "--bullmq",
  rabbitmq: "--rabbitmq",
  kafka: "--kafka",
  postgres: "--postgres",
};

const nodePositions: Record<ServiceName, { x: number; y: number }> = {
  elysia: { x: 20, y: 180 },
  redis: { x: 260, y: 60 },
  bullmq: { x: 260, y: 300 },
  rabbitmq: { x: 520, y: 180 },
  kafka: { x: 780, y: 60 },
  postgres: { x: 780, y: 300 },
};

const baseEdgePairs: ReadonlyArray<{
  source: ServiceName;
  target: ServiceName;
}> = [
  { source: "elysia", target: "redis" },
  { source: "redis", target: "bullmq" },
  { source: "bullmq", target: "rabbitmq" },
  { source: "rabbitmq", target: "kafka" },
  { source: "kafka", target: "postgres" },
];

const videoRenditions = ["240p", "360p", "720p", "1080p", "4k"] as const;
type VideoRendition = (typeof videoRenditions)[number];

const videoNodePositions: Record<
  "parent" | "dlq" | `child-${VideoRendition}`,
  { x: number; y: number }
> = {
  parent: { x: 480, y: 328 },
  "child-240p": { x: 322, y: 432 },
  "child-360p": { x: 410, y: 432 },
  "child-720p": { x: 498, y: 432 },
  "child-1080p": { x: 586, y: 432 },
  "child-4k": { x: 674, y: 432 },
  dlq: { x: 790, y: 432 },
};

type ServiceStats = {
  count: number;
  latencyTotal: number;
  errors: number;
  queueDepth: number;
  lastSeenAt: number;
};

type EdgeStats = {
  count: number;
  active: boolean;
};

type VideoGraphSnapshot = {
  parentCreated: number;
  childCreatedByRendition: Record<VideoRendition, number>;
  progressByRendition: Record<VideoRendition, number>;
  dlqRenditions: Set<VideoRendition>;
};

export interface ServiceMetric {
  service: ServiceName;
  label: string;
  opsPerSec: number;
  queueDepth: number;
  avgLatencyMs: number;
  errorCount: number;
  status: ServiceStatus;
}

function getDefaultTarget(event: SimulationEvent): ServiceName | undefined {
  if (event.target) {
    return event.target;
  }

  switch (event.kind) {
    case "request.received":
    case "request.rejected":
      return "redis";
    case "redis.op":
      return "bullmq";
    case "bullmq.job.created":
    case "bullmq.job.processing":
    case "bullmq.job.completed":
    case "bullmq.job.failed":
    case "bullmq.job.dlq":
    case "bullmq.job.progress":
      return "rabbitmq";
    case "rabbitmq.published":
    case "rabbitmq.routed":
    case "rabbitmq.consumed":
    case "rabbitmq.ack":
      return "kafka";
    case "kafka.produced":
    case "kafka.consumed":
      return "postgres";
    default:
      return undefined;
  }
}

function createDefaultServiceStats(): Record<ServiceName, ServiceStats> {
  return {
    elysia: {
      count: 0,
      latencyTotal: 0,
      errors: 0,
      queueDepth: 0,
      lastSeenAt: 0,
    },
    redis: {
      count: 0,
      latencyTotal: 0,
      errors: 0,
      queueDepth: 0,
      lastSeenAt: 0,
    },
    bullmq: {
      count: 0,
      latencyTotal: 0,
      errors: 0,
      queueDepth: 0,
      lastSeenAt: 0,
    },
    rabbitmq: {
      count: 0,
      latencyTotal: 0,
      errors: 0,
      queueDepth: 0,
      lastSeenAt: 0,
    },
    kafka: {
      count: 0,
      latencyTotal: 0,
      errors: 0,
      queueDepth: 0,
      lastSeenAt: 0,
    },
    postgres: {
      count: 0,
      latencyTotal: 0,
      errors: 0,
      queueDepth: 0,
      lastSeenAt: 0,
    },
  };
}

function createDefaultEdgeStats(): Record<string, EdgeStats> {
  return {
    "elysia->redis": { count: 0, active: false },
    "redis->bullmq": { count: 0, active: false },
    "bullmq->rabbitmq": { count: 0, active: false },
    "rabbitmq->kafka": { count: 0, active: false },
    "kafka->postgres": { count: 0, active: false },
  };
}

function isVideoRendition(value: string): value is VideoRendition {
  return videoRenditions.includes(value as VideoRendition);
}

function createVideoGraphSnapshot(events: SimulationEvent[]): VideoGraphSnapshot {
  const childCreatedByRendition: Record<VideoRendition, number> = {
    "240p": 0,
    "360p": 0,
    "720p": 0,
    "1080p": 0,
    "4k": 0,
  };

  const progressByRendition: Record<VideoRendition, number> = {
    "240p": 0,
    "360p": 0,
    "720p": 0,
    "1080p": 0,
    "4k": 0,
  };

  const dlqRenditions = new Set<VideoRendition>();
  let parentCreated = 0;

  for (const event of events) {
    const workflow = event.data.workflow;
    const renditionRaw = event.data.rendition;
    const rendition =
      typeof renditionRaw === "string" && isVideoRendition(renditionRaw)
        ? renditionRaw
        : null;

    if (event.kind === "bullmq.job.created" && workflow === "video-parent") {
      parentCreated += 1;
      continue;
    }

    if (
      event.kind === "bullmq.job.created" &&
      workflow === "video-child" &&
      rendition
    ) {
      childCreatedByRendition[rendition] += 1;
      continue;
    }

    if (
      event.kind === "bullmq.job.progress" &&
      workflow === "video-child" &&
      rendition
    ) {
      const progressValue = event.data.progress;
      if (typeof progressValue === "number") {
        progressByRendition[rendition] = Math.max(
          progressByRendition[rendition],
          Math.trunc(progressValue),
        );
      }
      continue;
    }

    if (
      event.kind === "bullmq.job.completed" &&
      workflow === "video-child" &&
      rendition
    ) {
      progressByRendition[rendition] = 100;
      continue;
    }

    if (
      event.kind === "bullmq.job.dlq" &&
      workflow === "video-child" &&
      rendition
    ) {
      dlqRenditions.add(rendition);
    }
  }

  return {
    parentCreated,
    childCreatedByRendition,
    progressByRendition,
    dlqRenditions,
  };
}

export function useFlowState(
  events: SimulationEvent[],
  scenarioId: SupportedScenarioId,
): {
  nodes: Node<ServiceNodeData, "serviceNode">[];
  edges: Edge<AnimatedEdgeData, "animatedEdge">[];
  metrics: ServiceMetric[];
} {
  return useMemo(() => {
    const serviceStats = createDefaultServiceStats();
    const edgeStats = createDefaultEdgeStats();

    for (const event of events) {
      const sourceStats = serviceStats[event.source];
      sourceStats.count += 1;
      sourceStats.latencyTotal += event.latencyMs;
      sourceStats.lastSeenAt = event.timestamp;

      if (
        event.kind === "request.rejected" ||
        event.kind === "bullmq.job.failed"
      ) {
        sourceStats.errors += 1;
      }

      if (event.kind === "bullmq.job.created") {
        serviceStats.bullmq.queueDepth += 1;
      }

      if (
        event.kind === "bullmq.job.completed" ||
        event.kind === "bullmq.job.failed"
      ) {
        serviceStats.bullmq.queueDepth = Math.max(
          0,
          serviceStats.bullmq.queueDepth - 1,
        );
      }

      if (event.kind === "rabbitmq.published") {
        serviceStats.rabbitmq.queueDepth += 1;
      }

      if (event.kind === "rabbitmq.ack") {
        serviceStats.rabbitmq.queueDepth = Math.max(
          0,
          serviceStats.rabbitmq.queueDepth - 1,
        );
      }

      const target = getDefaultTarget(event);
      if (!target) {
        continue;
      }

      const edgeKey = `${event.source}->${target}`;
      const edgeStat = edgeStats[edgeKey];
      if (!edgeStat) {
        continue;
      }

      edgeStat.count += 1;
      edgeStat.active = true;
    }

    const firstTimestamp = events[0]?.timestamp ?? Date.now();
    const lastTimestamp =
      events[events.length - 1]?.timestamp ?? firstTimestamp;
    const rangeMs = Math.max(1000, lastTimestamp - firstTimestamp);

    const metrics: ServiceMetric[] = serviceNames.map((serviceName) => {
      const stats = serviceStats[serviceName];
      const opsPerSec = Number(((stats.count * 1000) / rangeMs).toFixed(1));
      const avgLatencyMs =
        stats.count > 0 ? Math.round(stats.latencyTotal / stats.count) : 0;

      let status: ServiceStatus = "idle";
      if (stats.errors > 0) {
        status = "error";
      } else if (stats.count > 0) {
        status = "active";
      }

      return {
        service: serviceName,
        label: serviceLabels[serviceName],
        opsPerSec,
        queueDepth: stats.queueDepth,
        avgLatencyMs,
        errorCount: stats.errors,
        status,
      };
    });

    const nodes: Node<ServiceNodeData, "serviceNode">[] = serviceNames.map(
      (serviceName) => {
        const metric = metrics.find((entry) => entry.service === serviceName);
        if (!metric) {
          throw new Error(`Missing metric for ${serviceName}`);
        }

        return {
          id: serviceName,
          type: "serviceNode",
          position: nodePositions[serviceName],
          data: {
            service: serviceName,
            label: metric.label,
            status: metric.status,
            opsPerSec: metric.opsPerSec,
            queueDepth: metric.queueDepth,
            colorVar: serviceColorVars[serviceName],
          },
        };
      },
    );

    const edges: Edge<AnimatedEdgeData, "animatedEdge">[] = baseEdgePairs.map(
      (edgePair) => {
        const edgeKey = `${edgePair.source}->${edgePair.target}`;
        const stats = edgeStats[edgeKey] ?? { count: 0, active: false };

        return {
          id: edgeKey,
          source: edgePair.source,
          target: edgePair.target,
          type: "animatedEdge",
          animated: stats.count > 0,
          data: {
            messageCount: stats.count,
            colorVar: serviceColorVars[edgePair.source],
            active: stats.active,
          },
        };
      },
    );

    if (scenarioId !== "video-pipeline") {
      return {
        nodes,
        edges,
        metrics,
      };
    }

    const videoSnapshot = createVideoGraphSnapshot(events);

    const videoNodes: Node<ServiceNodeData, "serviceNode">[] = [];

    videoNodes.push({
      id: "video-parent",
      type: "serviceNode",
      position: videoNodePositions.parent,
      data: {
        service: "bullmq",
        label: "Parent Flow",
        status: videoSnapshot.parentCreated > 0 ? "active" : "idle",
        opsPerSec: videoSnapshot.parentCreated,
        queueDepth: 0,
        colorVar: "--bullmq",
      },
    });

    for (const rendition of videoRenditions) {
      const createdCount = videoSnapshot.childCreatedByRendition[rendition];
      const progress = videoSnapshot.progressByRendition[rendition];
      const inDlq = videoSnapshot.dlqRenditions.has(rendition);

      const status: ServiceStatus = inDlq
        ? "error"
        : createdCount > 0 || progress > 0
          ? "active"
          : "idle";

      videoNodes.push({
        id: `video-child-${rendition}`,
        type: "serviceNode",
        position: videoNodePositions[`child-${rendition}`],
        data: {
          service: "bullmq",
          label: `${rendition}${inDlq ? " DLQ" : ` ${progress}%`}`,
          status,
          opsPerSec: Number((progress / 100).toFixed(1)),
          queueDepth: inDlq ? 1 : 0,
          colorVar: "--bullmq",
        },
      });
    }

    videoNodes.push({
      id: "video-dlq",
      type: "serviceNode",
      position: videoNodePositions.dlq,
      data: {
        service: "bullmq",
        label: "DLQ Graveyard",
        status: videoSnapshot.dlqRenditions.size > 0 ? "error" : "idle",
        opsPerSec: videoSnapshot.dlqRenditions.size,
        queueDepth: videoSnapshot.dlqRenditions.size,
        colorVar: "--rabbitmq",
      },
    });

    const videoEdges: Edge<AnimatedEdgeData, "animatedEdge">[] = [
      {
        id: "bullmq->video-parent",
        source: "bullmq",
        target: "video-parent",
        type: "animatedEdge",
        animated: videoSnapshot.parentCreated > 0,
        data: {
          messageCount: videoSnapshot.parentCreated,
          colorVar: "--bullmq",
          active: videoSnapshot.parentCreated > 0,
        },
      },
    ];

    for (const rendition of videoRenditions) {
      const createdCount = videoSnapshot.childCreatedByRendition[rendition];

      videoEdges.push({
        id: `video-parent->video-child-${rendition}`,
        source: "video-parent",
        target: `video-child-${rendition}`,
        type: "animatedEdge",
        animated: createdCount > 0,
        data: {
          messageCount: createdCount,
          colorVar: "--bullmq",
          active: createdCount > 0,
        },
      });

      if (!videoSnapshot.dlqRenditions.has(rendition)) {
        continue;
      }

      videoEdges.push({
        id: `video-child-${rendition}->video-dlq`,
        source: `video-child-${rendition}`,
        target: "video-dlq",
        type: "animatedEdge",
        animated: true,
        data: {
          messageCount: 1,
          colorVar: "--rabbitmq",
          active: true,
        },
      });
    }

    return {
      nodes: [...nodes, ...videoNodes],
      edges: [...edges, ...videoEdges],
      metrics,
    };
  }, [events, scenarioId]);
}

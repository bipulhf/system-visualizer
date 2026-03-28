import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { AnimatedEdgeData } from "~/components/flow/animated-edge";
import type {
  ServiceNodeData,
  ServiceStatus,
} from "~/components/flow/service-node";
import type { ServiceName, SimulationEvent } from "~/lib/event-types";
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

export function useFlowState(events: SimulationEvent[]): {
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

    return {
      nodes,
      edges,
      metrics,
    };
  }, [events]);
}

import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  AnimatedEdge,
  type AnimatedEdgeData,
} from "~/components/flow/animated-edge";
import {
  ServiceNode,
  type ServiceNodeData,
} from "~/components/flow/service-node";
import type { ServiceName } from "~/lib/event-types";

const nodeTypes = { serviceNode: ServiceNode };
const edgeTypes = { animatedEdge: AnimatedEdge };

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

const edgePairs: ReadonlyArray<{ source: ServiceName; target: ServiceName }> =
  [
    { source: "elysia", target: "redis" },
    { source: "redis", target: "bullmq" },
    { source: "bullmq", target: "rabbitmq" },
    { source: "rabbitmq", target: "kafka" },
    { source: "kafka", target: "postgres" },
  ];

const serviceNames: ServiceName[] = [
  "elysia",
  "redis",
  "bullmq",
  "rabbitmq",
  "kafka",
  "postgres",
];

export function TraceFlowCanvas({
  activeSource,
  activeTarget,
}: {
  activeSource: ServiceName | null;
  activeTarget: ServiceName | null;
}) {
  const nodes: Node<ServiceNodeData, "serviceNode">[] = serviceNames.map(
    (name) => ({
      id: name,
      type: "serviceNode" as const,
      position: nodePositions[name],
      data: {
        service: name,
        label: serviceLabels[name],
        colorVar: serviceColorVars[name],
        status: (name === activeSource ? "active" : "idle") as ServiceNodeData["status"],
        opsPerSec: 0,
        queueDepth: 0,
      },
    }),
  );

  const edges: Edge<AnimatedEdgeData, "animatedEdge">[] = edgePairs.map(
    ({ source, target }) => {
      const isActive =
        source === activeSource && target === activeTarget;
      const colorVar = serviceColorVars[source];

      return {
        id: `${source}-${target}`,
        source,
        target,
        type: "animatedEdge" as const,
        data: {
          messageCount: isActive ? 1 : 0,
          colorVar,
          active: isActive,
        },
      };
    },
  );

  return (
    <div className="h-[280px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
      <ReactFlow<
        Node<ServiceNodeData, "serviceNode">,
        Edge<AnimatedEdgeData, "animatedEdge">
      >
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background gap={24} size={1} color="var(--border)" />
        <Controls showInteractive={false} showFitView={false} showZoom={false} />
      </ReactFlow>
    </div>
  );
}

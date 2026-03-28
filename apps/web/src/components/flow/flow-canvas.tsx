import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  MiniMap,
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

const nodeTypes = {
  serviceNode: ServiceNode,
};

const edgeTypes = {
  animatedEdge: AnimatedEdge,
};

export function FlowCanvas({
  nodes,
  edges,
}: {
  nodes: Node<ServiceNodeData, "serviceNode">[];
  edges: Edge<AnimatedEdgeData, "animatedEdge">[];
}) {
  return (
    <div className="h-[460px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
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
        panOnDrag
      >
        <Background gap={24} size={1} color="var(--border)" />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Server } from "lucide-react";
import type { ServiceName } from "~/lib/event-types";

export type ServiceStatus = "idle" | "active" | "error";

export interface ServiceNodeData extends Record<
  string,
  string | number | boolean
> {
  service: ServiceName;
  label: string;
  status: ServiceStatus;
  opsPerSec: number;
  queueDepth: number;
  colorVar: string;
}

export type ServiceNodeType = Node<ServiceNodeData, "serviceNode">;

const statusColorByStatus: Record<ServiceStatus, string> = {
  idle: "bg-zinc-500",
  active: "bg-emerald-500",
  error: "bg-red-500",
};

export function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  return (
    <article
      className="neo-panel min-w-[170px] bg-[var(--background)] p-3"
      style={{ borderColor: `var(${data.colorVar})` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-sm font-black">
          <Server className="h-3.5 w-3.5" />
          {data.label}
        </p>
        <span
          className={`h-2.5 w-2.5 rounded-full ${statusColorByStatus[data.status]} ${
            data.status === "active" ? "animate-pulse" : ""
          }`}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-semibold">
        <div className="neo-panel bg-[var(--surface)] px-1 py-0.5">
          Ops/s: {data.opsPerSec.toFixed(1)}
        </div>
        <div className="neo-panel bg-[var(--surface)] px-1 py-0.5">
          Queue: {data.queueDepth}
        </div>
      </div>
    </article>
  );
}

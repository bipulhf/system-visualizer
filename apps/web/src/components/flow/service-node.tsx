import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Server } from "lucide-react";
import type { ServiceName } from "~/lib/event-types";

export type ServiceStatus = "idle" | "active" | "error";

export interface ServiceNodeData
  extends Record<string, string | number | boolean> {
  service: ServiceName;
  label: string;
  status: ServiceStatus;
  opsPerSec: number;
  queueDepth: number;
  colorVar: string;
}

export type ServiceNodeType = Node<ServiceNodeData, "serviceNode">;

const statusColorByStatus: Record<ServiceStatus, string> = {
  idle: "bg-zinc-400",
  active: "bg-emerald-500",
  error: "bg-red-500",
};

export function ServiceNode({ data }: NodeProps<ServiceNodeType>) {
  return (
    <article className="min-w-[160px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="h-1" style={{ background: `var(${data.colorVar})` }} />
      <div className="p-3">
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
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Server className="h-3.5 w-3.5 text-[var(--muted)]" />
            {data.label}
          </p>
          <span
            className={`h-2 w-2 rounded-full ${statusColorByStatus[data.status]} ${
              data.status === "active" ? "animate-pulse" : ""
            }`}
          />
        </div>

        <div className="mt-2 flex gap-1.5">
          <div className="card-inset flex-1 rounded-md px-2 py-1 text-[11px]">
            <span className="text-[var(--muted)]">Ops/s</span>
            <p className="font-semibold">{data.opsPerSec.toFixed(1)}</p>
          </div>
          <div className="card-inset flex-1 rounded-md px-2 py-1 text-[11px]">
            <span className="text-[var(--muted)]">Queue</span>
            <p className="font-semibold">{data.queueDepth}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

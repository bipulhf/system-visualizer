import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { motion } from "motion/react";
import { MessageBadge } from "~/components/flow/message-badge";

export interface AnimatedEdgeData extends Record<
  string,
  string | number | boolean
> {
  messageCount: number;
  colorVar: string;
  active: boolean;
}

export type AnimatedEdgeType = Edge<AnimatedEdgeData, "animatedEdge">;

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<AnimatedEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const strokeColor = `var(${data?.colorVar ?? "--main"})`;
  const messageCount = data?.messageCount ?? 0;
  const particleCount = data?.active
    ? Math.min(4, Math.max(1, Math.ceil(messageCount / 3)))
    : 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: strokeColor, strokeWidth: 2 }}
      />

      <g pointerEvents="none">
        {Array.from({ length: particleCount }).map((_, index) => (
          <motion.circle
            key={`${id}-particle-${index}`}
            r={3}
            fill={strokeColor}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
            transition={{
              duration: 1.3,
              ease: "linear",
              repeat: Infinity,
              delay: index * 0.25,
            }}
          >
            <animateMotion
              dur="1.3s"
              repeatCount="indefinite"
              begin={`${(index * 0.25).toFixed(2)}s`}
              path={edgePath}
            />
          </motion.circle>
        ))}
      </g>

      {messageCount > 0 ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
          >
            <MessageBadge count={messageCount} />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

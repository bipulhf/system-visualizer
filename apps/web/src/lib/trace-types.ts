import type { ServiceName, EventKind } from "./event-types";

export type TraceStep = {
  id: string;
  timestamp: number;
  scenario: string;
  phase: number;
  kind: EventKind;
  source: ServiceName;
  target?: ServiceName;
  data: Record<string, string | number | boolean | null>;
  latencyMs: number;
  description: string;
  learnMore?: string;
  stepIndex: number;
  cumulativeLatencyMs: number;
};

export type TraceScenarioId =
  | "flash-sale"
  | "ride-sharing"
  | "video-pipeline"
  | "banking";

export type TraceResult = {
  requestId: string;
  steps: TraceStep[];
  totalLatencyMs: number;
  startedAt: number;
  scenarioId: TraceScenarioId;
  scenarioLabel: string;
};

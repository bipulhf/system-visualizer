export type ScenarioId =
  | "flash-sale"
  | "ride-sharing"
  | "video-pipeline"
  | "banking";

export interface ScenarioMeta {
  id: ScenarioId;
  title: string;
  tagline: string;
  difficulty: "intro" | "intermediate" | "advanced";
}

export const scenarios: readonly ScenarioMeta[] = [
  {
    id: "flash-sale",
    title: "E-Commerce Flash Sale",
    tagline: "Defend inventory and throughput under a request storm.",
    difficulty: "intro",
  },
  {
    id: "ride-sharing",
    title: "Ride-Sharing Dispatch",
    tagline: "Match riders and nearby drivers with low latency.",
    difficulty: "intermediate",
  },
  {
    id: "video-pipeline",
    title: "Video Transcoding Pipeline",
    tagline: "Coordinate parallel jobs and resilient failure handling.",
    difficulty: "intermediate",
  },
  {
    id: "banking",
    title: "Banking Transaction Ledger",
    tagline: "Guarantee correctness with idempotency and serializable writes.",
    difficulty: "advanced",
  },
];

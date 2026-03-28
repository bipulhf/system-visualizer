import { Link } from "@tanstack/react-router";
import type { SimulationEvent } from "~/lib/event-types";
import {
  scenarioInfoById,
  type SupportedScenarioId,
} from "~/lib/learning-content";

const scenarioPathById: Record<SupportedScenarioId, string> = {
  "flash-sale": "/scenarios/flash-sale",
  "ride-sharing": "/scenarios/ride-sharing",
  "video-pipeline": "/scenarios/video-pipeline",
  banking: "/scenarios/banking",
};

const redisComparisonByScenario: Record<SupportedScenarioId, string> = {
  "flash-sale":
    "Redis protects stock integrity with atomic counters under burst concurrency.",
  "ride-sharing":
    "Redis keeps live driver coordinates queryable with geo indexing and TTL heartbeats.",
  "video-pipeline":
    "Redis tracks per-rendition progress and expires transient state automatically.",
  banking:
    "Redis gates transfer idempotency and lock contention before durable money movement.",
};

function summarizeEvents(events: SimulationEvent[]): {
  totalEvents: number;
  totalFailures: number;
  totalMessages: number;
  avgLatencyMs: number;
} {
  const totalEvents = events.length;
  const totalFailures = events.filter(
    (event) =>
      event.kind === "request.rejected" ||
      event.kind === "bullmq.job.failed" ||
      event.kind === "bullmq.job.dlq",
  ).length;
  const totalMessages = events.filter(
    (event) =>
      event.kind === "rabbitmq.published" ||
      event.kind === "rabbitmq.routed" ||
      event.kind === "kafka.produced",
  ).length;
  const totalLatency = events.reduce((sum, event) => sum + event.latencyMs, 0);
  const avgLatencyMs =
    totalEvents > 0 ? Math.round(totalLatency / totalEvents) : 0;

  return {
    totalEvents,
    totalFailures,
    totalMessages,
    avgLatencyMs,
  };
}

export function SummaryCard({
  scenarioId,
  events,
  isVisible,
}: {
  scenarioId: SupportedScenarioId;
  events: SimulationEvent[];
  isVisible: boolean;
}) {
  if (!isVisible) {
    return null;
  }

  const stats = summarizeEvents(events);
  const scenarioInfo = scenarioInfoById[scenarioId];

  return (
    <section
      className="neo-panel mt-3 grid gap-3 bg-[var(--surface)] p-3 lg:grid-cols-[1.1fr,1fr]"
      aria-live="polite"
    >
      <article className="space-y-2">
        <h3 className="text-sm font-black uppercase tracking-wide">
          Scenario Summary
        </h3>
        <p className="text-sm font-black">{scenarioInfo.title}</p>
        <p className="text-xs leading-relaxed">{scenarioInfo.tagline}</p>

        <div className="grid grid-cols-2 gap-2 text-xs font-semibold sm:grid-cols-4">
          <div className="neo-panel bg-[var(--background)] p-2">
            Events
            <p className="mt-1 text-base font-black">{stats.totalEvents}</p>
          </div>
          <div className="neo-panel bg-[var(--background)] p-2">
            Routed Msgs
            <p className="mt-1 text-base font-black">{stats.totalMessages}</p>
          </div>
          <div className="neo-panel bg-[var(--background)] p-2">
            Failures
            <p className="mt-1 text-base font-black">{stats.totalFailures}</p>
          </div>
          <div className="neo-panel bg-[var(--background)] p-2">
            Avg Latency
            <p className="mt-1 text-base font-black">{stats.avgLatencyMs}ms</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={scenarioPathById[scenarioId]}
            className="neo-panel inline-flex h-10 items-center bg-[var(--main)] px-3 text-xs font-black uppercase tracking-wide transition-transform duration-150 hover:-translate-x-[var(--box-shadow-x)] hover:-translate-y-[var(--box-shadow-y)] hover:shadow-none"
          >
            Replay Scenario
          </Link>
          <Link
            to="/learn"
            className="neo-panel inline-flex h-10 items-center bg-[var(--surface)] px-3 text-xs font-black uppercase tracking-wide"
          >
            Review Concepts
          </Link>
        </div>
      </article>

      <article className="neo-panel bg-[var(--background)] p-3">
        <h4 className="text-xs font-black uppercase tracking-wide">
          Cross-Scenario Comparison
        </h4>
        <p className="mt-2 text-xs font-black uppercase tracking-wide">
          Redis In Flash Sale vs Banking
        </p>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed">
          <li className="neo-panel bg-[var(--surface)] p-2">
            Flash Sale: {redisComparisonByScenario["flash-sale"]}
          </li>
          <li className="neo-panel bg-[var(--surface)] p-2">
            Banking: {redisComparisonByScenario.banking}
          </li>
          <li className="neo-panel bg-[var(--surface)] p-2">
            Current Scenario Insight: {redisComparisonByScenario[scenarioId]}
          </li>
        </ul>
      </article>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
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
      className="card mt-3 grid gap-4 rounded-xl p-4 lg:grid-cols-[1.1fr,1fr]"
      aria-live="polite"
    >
      <article className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Scenario Complete
          </h3>
          <p className="mt-1 text-base font-semibold">{scenarioInfo.title}</p>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {scenarioInfo.tagline}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="card-inset rounded-lg p-2.5">
            <p className="text-[var(--muted)]">Events</p>
            <p className="mt-0.5 text-lg font-bold">{stats.totalEvents}</p>
          </div>
          <div className="card-inset rounded-lg p-2.5">
            <p className="text-[var(--muted)]">Routed</p>
            <p className="mt-0.5 text-lg font-bold">{stats.totalMessages}</p>
          </div>
          <div className="card-inset rounded-lg p-2.5">
            <p className="text-[var(--muted)]">Failures</p>
            <p className="mt-0.5 text-lg font-bold">{stats.totalFailures}</p>
          </div>
          <div className="card-inset rounded-lg p-2.5">
            <p className="text-[var(--muted)]">Avg ms</p>
            <p className="mt-0.5 text-lg font-bold">{stats.avgLatencyMs}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to={scenarioPathById[scenarioId]}>Replay Scenario</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/learn">Review Concepts</Link>
          </Button>
        </div>
      </article>

      <article className="card-inset rounded-xl p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Cross-Scenario: Redis
        </h4>
        <p className="mt-1.5 text-xs font-semibold">Flash Sale vs Banking</p>
        <ul className="mt-2 space-y-1.5 text-xs">
          <li className="card-inset rounded-lg p-2 leading-relaxed">
            Flash Sale: {redisComparisonByScenario["flash-sale"]}
          </li>
          <li className="card-inset rounded-lg p-2 leading-relaxed">
            Banking: {redisComparisonByScenario.banking}
          </li>
          <li
            className="card-inset rounded-lg p-2 leading-relaxed font-medium"
            style={{ color: "var(--main)" }}
          >
            Current: {redisComparisonByScenario[scenarioId]}
          </li>
        </ul>
      </article>
    </section>
  );
}

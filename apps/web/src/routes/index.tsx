import { Link, createFileRoute } from "@tanstack/react-router";
import {
  scenarioInfoById,
  supportedScenarioIds,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const scenarioMetaById: Record<
  SupportedScenarioId,
  { difficulty: "Beginner" | "Intermediate" | "Advanced"; path: string }
> = {
  "flash-sale": {
    difficulty: "Beginner",
    path: "/scenarios/flash-sale",
  },
  "ride-sharing": {
    difficulty: "Intermediate",
    path: "/scenarios/ride-sharing",
  },
  "video-pipeline": {
    difficulty: "Intermediate",
    path: "/scenarios/video-pipeline",
  },
  banking: {
    difficulty: "Advanced",
    path: "/scenarios/banking",
  },
};

const technologyHighlights = [
  {
    label: "Redis",
    description: "Atomic counters, idempotency keys, geo lookup, TTL locks",
  },
  {
    label: "BullMQ",
    description: "Retries, delayed workflows, and dead-letter handling",
  },
  {
    label: "RabbitMQ",
    description: "Fan-out, routing keys, competing consumers, confirms",
  },
  {
    label: "Kafka",
    description: "Replayable event logs and independent consumer groups",
  },
  {
    label: "PostgreSQL",
    description: "Transactional durability and serializable consistency",
  },
  {
    label: "Elysia",
    description: "Low-overhead ingress for high-concurrency simulations",
  },
];

function HomePage() {
  return (
    <section className="neo-panel overflow-hidden bg-[var(--background)] p-4 md:p-6">
      <div className="relative overflow-hidden rounded-sm border-2 border-[var(--border)] bg-[var(--surface)] p-5 md:p-8">
        <div className="absolute -left-16 top-6 h-44 w-44 rounded-full bg-[var(--main)]/30 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-52 w-52 rounded-full bg-[var(--kafka)]/25 blur-3xl" />

        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <article className="space-y-4">
            <p className="inline-flex border-2 border-[var(--border)] bg-[var(--redis)] px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em]">
              Distributed Systems Learning Lab
            </p>
            <h1 className="max-w-2xl text-3xl font-black leading-[1.03] tracking-tight sm:text-4xl lg:text-5xl">
              See Real Infrastructure Behavior Instead of Reading Static
              Diagrams.
            </h1>
            <p className="max-w-xl text-sm font-semibold leading-relaxed sm:text-base">
              System Visualizer animates live event flows from Redis, BullMQ,
              RabbitMQ, Kafka, and PostgreSQL so you can inspect failures,
              retries, ordering, and consistency in motion.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/scenarios/flash-sale">Quick Start Scenario 1</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/learn">Open Learn Section</Link>
              </Button>
            </div>
          </article>

          <article className="neo-panel grid gap-2 bg-[var(--background)] p-3">
            <p className="text-xs font-black uppercase tracking-wide">
              Live Preview
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="neo-panel bg-[var(--main)]/25 p-2 text-xs font-black uppercase">
                Requests
                <p className="mt-1 text-lg">10K+</p>
              </div>
              <div className="neo-panel bg-[var(--redis)]/30 p-2 text-xs font-black uppercase">
                Ops/sec
                <p className="mt-1 text-lg">1.9k</p>
              </div>
              <div className="neo-panel bg-[var(--rabbitmq)]/30 p-2 text-xs font-black uppercase">
                Routed Msgs
                <p className="mt-1 text-lg">4.2k</p>
              </div>
              <div className="neo-panel bg-[var(--kafka)]/30 p-2 text-xs font-black uppercase">
                Stream Events
                <p className="mt-1 text-lg">30k</p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <section className="mt-4">
        <h2 className="text-sm font-black uppercase tracking-wide">
          Scenario Tracks
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {supportedScenarioIds.map((scenarioId) => {
            const scenarioInfo = scenarioInfoById[scenarioId];
            const scenarioMeta = scenarioMetaById[scenarioId];

            return (
              <article
                key={scenarioId}
                className="neo-panel flex h-full flex-col bg-[var(--surface)] p-3"
              >
                <div className="neo-panel h-24 bg-[var(--background)] p-2">
                  <p className="text-[11px] font-black uppercase tracking-wide">
                    {scenarioInfo.title}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-snug">
                    {scenarioInfo.tagline}
                  </p>
                </div>
                <p className="mt-2 text-xs font-black uppercase tracking-wide">
                  Difficulty: {scenarioMeta.difficulty}
                </p>
                <p className="mt-1 flex-1 text-sm leading-relaxed">
                  {scenarioInfo.problem}
                </p>
                <Button className="mt-3" asChild>
                  <Link to={scenarioMeta.path}>
                    Explore {scenarioInfo.title}
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-black uppercase tracking-wide">
          What You Will Learn
        </h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {technologyHighlights.map((technology) => (
            <article
              key={technology.label}
              className="neo-panel bg-[var(--surface)] p-3"
            >
              <h3 className="text-xs font-black uppercase tracking-wide">
                {technology.label}
              </h3>
              <p className="mt-1 text-xs leading-relaxed">
                {technology.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

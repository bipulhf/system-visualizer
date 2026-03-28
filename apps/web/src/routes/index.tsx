import { Link, createFileRoute } from "@tanstack/react-router";
import {
  scenarioInfoById,
  supportedScenarioIds,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/")({
  ssr: true,
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

const difficultyColorClass: Record<
  "Beginner" | "Intermediate" | "Advanced",
  string
> = {
  Beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Advanced: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const technologyHighlights = [
  {
    label: "Redis",
    colorVar: "--redis",
    description: "Atomic counters, idempotency keys, geo lookup, TTL locks",
  },
  {
    label: "BullMQ",
    colorVar: "--bullmq",
    description: "Retries, delayed workflows, and dead-letter handling",
  },
  {
    label: "RabbitMQ",
    colorVar: "--rabbitmq",
    description: "Fan-out, routing keys, competing consumers, confirms",
  },
  {
    label: "Kafka",
    colorVar: "--kafka",
    description: "Replayable event logs and independent consumer groups",
  },
  {
    label: "PostgreSQL",
    colorVar: "--postgres",
    description: "Transactional durability and serializable consistency",
  },
  {
    label: "Elysia",
    colorVar: "--main",
    description: "Low-overhead ingress for high-concurrency simulations",
  },
];

function HomePage() {
  return (
    <div className="space-y-6 py-2">
      <div className="card overflow-hidden rounded-2xl p-6 md:p-8">
        <div className="absolute -left-16 top-6 h-44 w-44 rounded-full bg-[var(--main)]/20 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-52 w-52 rounded-full bg-[var(--kafka)]/15 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <article className="space-y-4">
            <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
              Distributed Systems Learning Lab
            </span>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              See Real Infrastructure Behavior Instead of Reading Static
              Diagrams.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              System Visualizer animates live event flows from Redis, BullMQ,
              RabbitMQ, Kafka, and PostgreSQL so you can inspect failures,
              retries, ordering, and consistency in motion.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/scenarios/flash-sale">Quick Start</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/learn">Browse Concepts</Link>
              </Button>
            </div>
          </article>

          <article className="card-inset grid gap-2 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Live Preview
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="card-inset rounded-lg p-3 text-xs">
                <p className="text-[var(--muted)]">Requests</p>
                <p className="mt-0.5 text-xl font-bold">10K+</p>
              </div>
              <div className="card-inset rounded-lg p-3 text-xs">
                <p className="text-[var(--muted)]">Ops/sec</p>
                <p className="mt-0.5 text-xl font-bold">1.9k</p>
              </div>
              <div className="card-inset rounded-lg p-3 text-xs">
                <p className="text-[var(--muted)]">Routed Msgs</p>
                <p className="mt-0.5 text-xl font-bold">4.2k</p>
              </div>
              <div className="card-inset rounded-lg p-3 text-xs">
                <p className="text-[var(--muted)]">Stream Events</p>
                <p className="mt-0.5 text-xl font-bold">30k</p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Scenario Tracks
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {supportedScenarioIds.map((scenarioId) => {
            const scenarioInfo = scenarioInfoById[scenarioId];
            const scenarioMeta = scenarioMetaById[scenarioId];

            return (
              <article
                key={scenarioId}
                className="card card-interactive flex h-full flex-col rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{scenarioInfo.title}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${difficultyColorClass[scenarioMeta.difficulty]}`}
                  >
                    {scenarioMeta.difficulty}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {scenarioInfo.tagline}
                </p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--muted)]">
                  {scenarioInfo.problem}
                </p>
                <Button className="mt-4" asChild>
                  <Link to={scenarioMeta.path}>
                    Explore {scenarioInfo.title}
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          What You Will Learn
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {technologyHighlights.map((technology) => (
            <article
              key={technology.label}
              className="card-inset flex items-start gap-3 rounded-xl p-3"
            >
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: `var(${technology.colorVar})` }}
              />
              <div>
                <h3 className="text-sm font-semibold">{technology.label}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                  {technology.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

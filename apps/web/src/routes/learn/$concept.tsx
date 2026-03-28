import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  getConceptById,
  getScenarioLearningContent,
  scenarioInfoById,
  type ConceptGlossaryEntry,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/learn/$concept")({
  ssr: true,
  component: ConceptPage,
  loader: ({ params }) => {
    const conceptEntry = getConceptById(params.concept);
    if (!conceptEntry) {
      throw notFound();
    }

    return {
      conceptEntry,
    };
  },
});

const scenarioPathById: Record<SupportedScenarioId, string> = {
  "flash-sale": "/scenarios/flash-sale",
  "ride-sharing": "/scenarios/ride-sharing",
  "video-pipeline": "/scenarios/video-pipeline",
  banking: "/scenarios/banking",
};

function getRecommendedPhase(
  scenarioId: SupportedScenarioId,
  conceptId: string,
): number {
  const learningContent = getScenarioLearningContent(scenarioId);
  const conceptIndex = learningContent.conceptDefinitions.findIndex(
    (concept) => concept.id === conceptId,
  );

  if (conceptIndex < 0) {
    return 1;
  }

  return Math.min(learningContent.phases.length, conceptIndex + 1);
}

function ConceptPage() {
  const { conceptEntry } = Route.useLoaderData() as {
    conceptEntry: ConceptGlossaryEntry;
  };

  return (
    <div className="space-y-5 py-2">
      <header className="space-y-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/learn">← Back to Glossary</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {conceptEntry.title}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          {conceptEntry.description}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <article className="card rounded-xl p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Where It Appears
          </h2>
          <ul className="mt-3 space-y-2.5">
            {conceptEntry.scenarioIds.map((scenarioId: SupportedScenarioId) => {
              const phase = getRecommendedPhase(scenarioId, conceptEntry.id);

              return (
                <li
                  key={scenarioId}
                  className="card-inset rounded-lg p-3"
                >
                  <p className="text-sm font-semibold">
                    {scenarioInfoById[scenarioId].title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
                    {scenarioInfoById[scenarioId].tagline}
                  </p>
                  <div className="mt-2.5">
                    <Button asChild size="sm">
                      <Link
                        to={scenarioPathById[scenarioId]}
                        search={{ phase }}
                      >
                        See It In Action — Phase {phase}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <div className="space-y-3">
          <article className="card rounded-xl p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Visual Diagram
            </h2>
            <div className="mt-3 grid grid-cols-[1fr,auto,1fr] items-center gap-2">
              <div className="card-inset rounded-md p-2 text-center text-xs font-medium">
                Incoming Event
              </div>
              <span className="text-sm text-[var(--muted)]">→</span>
              <div
                className="rounded-md p-2 text-center text-xs font-semibold"
                style={{
                  background: `color-mix(in oklch, var(--main) 15%, transparent)`,
                  color: `var(--main)`,
                  border: `1px solid color-mix(in oklch, var(--main) 30%, transparent)`,
                }}
              >
                {conceptEntry.title}
              </div>
            </div>
          </article>

          <article className="card rounded-xl p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Trigger Events
            </h2>
            <ul className="mt-3 space-y-1.5">
              {conceptEntry.triggerKinds.map((triggerKind: string) => (
                <li
                  key={triggerKind}
                  className="card-inset rounded-md px-2.5 py-1.5 text-xs font-medium"
                >
                  {triggerKind}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </div>
  );
}

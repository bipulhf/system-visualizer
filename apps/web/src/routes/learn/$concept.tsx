import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  getConceptById,
  getScenarioLearningContent,
  scenarioInfoById,
  type ConceptGlossaryEntry,
  type SupportedScenarioId,
} from "~/lib/learning-content";

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
    <section className="neo-panel bg-[var(--background)] p-4 md:p-6">
      <header className="space-y-2">
        <Link
          to="/learn"
          className="neo-panel inline-flex h-9 items-center bg-[var(--surface)] px-3 text-[11px] font-black uppercase tracking-wide"
        >
          Back To Glossary
        </Link>
        <h1 className="text-3xl font-black tracking-tight">
          {conceptEntry.title}
        </h1>
        <p className="max-w-3xl text-sm font-semibold leading-relaxed">
          {conceptEntry.description}
        </p>
      </header>

      <section className="mt-4 grid gap-3 lg:grid-cols-[1.2fr,1fr]">
        <article className="neo-panel bg-[var(--surface)] p-3">
          <h2 className="text-xs font-black uppercase tracking-wide">
            Where It Appears
          </h2>
          <ul className="mt-2 space-y-2">
            {conceptEntry.scenarioIds.map((scenarioId: SupportedScenarioId) => {
              const phase = getRecommendedPhase(scenarioId, conceptEntry.id);

              return (
                <li
                  key={scenarioId}
                  className="neo-panel bg-[var(--background)] p-2"
                >
                  <p className="text-sm font-black">
                    {scenarioInfoById[scenarioId].title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {scenarioInfoById[scenarioId].tagline}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      to={scenarioPathById[scenarioId]}
                      search={{ phase }}
                      className="neo-panel inline-flex h-9 items-center bg-[var(--main)] px-3 text-[11px] font-black uppercase tracking-wide transition-transform duration-150 hover:-translate-x-[var(--box-shadow-x)] hover:-translate-y-[var(--box-shadow-y)] hover:shadow-none"
                    >
                      See It In Action (Phase {phase})
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <div className="space-y-3">
          <article className="neo-panel bg-[var(--surface)] p-3">
            <h2 className="text-xs font-black uppercase tracking-wide">
              Visual Diagram
            </h2>
            <div className="mt-2 grid grid-cols-[1fr,auto,1fr] items-center gap-2">
              <div className="neo-panel bg-[var(--background)] p-2 text-center text-[11px] font-black uppercase">
                Incoming Event
              </div>
              <span className="text-xs font-black">→</span>
              <div className="neo-panel bg-[var(--main)]/25 p-2 text-center text-[11px] font-black uppercase">
                {conceptEntry.title}
              </div>
            </div>
          </article>

          <article className="neo-panel bg-[var(--surface)] p-3">
            <h2 className="text-xs font-black uppercase tracking-wide">
              Trigger Events
            </h2>
            <ul className="mt-2 space-y-1">
              {conceptEntry.triggerKinds.map((triggerKind: string) => (
                <li
                  key={triggerKind}
                  className="neo-panel bg-[var(--background)] px-2 py-1 text-xs font-bold"
                >
                  {triggerKind}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </section>
  );
}

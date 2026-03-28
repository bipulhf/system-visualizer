import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getConceptGlossaryEntries,
  scenarioInfoById,
  type SupportedScenarioId,
} from "~/lib/learning-content";

export const Route = createFileRoute("/learn/")({
  ssr: true,
  component: LearnIndexPage,
});

const scenarioPathById: Record<SupportedScenarioId, string> = {
  "flash-sale": "/scenarios/flash-sale",
  "ride-sharing": "/scenarios/ride-sharing",
  "video-pipeline": "/scenarios/video-pipeline",
  banking: "/scenarios/banking",
};

function LearnIndexPage() {
  const [query, setQuery] = useState<string>("");
  const concepts = useMemo(() => getConceptGlossaryEntries(), []);

  const filteredConcepts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return concepts;
    }

    return concepts.filter((concept) => {
      return (
        concept.title.toLowerCase().includes(normalizedQuery) ||
        concept.description.toLowerCase().includes(normalizedQuery) ||
        concept.scenarioIds.some((scenarioId) =>
          scenarioInfoById[scenarioId].title
            .toLowerCase()
            .includes(normalizedQuery),
        )
      );
    });
  }, [concepts, query]);

  return (
    <section className="neo-panel bg-[var(--background)] p-4 md:p-6">
      <header className="space-y-2">
        <p className="inline-flex border-2 border-[var(--border)] bg-[var(--bullmq)] px-2 py-1 text-[11px] font-black uppercase tracking-wide">
          Learn Section
        </p>
        <h1 className="text-3xl font-black tracking-tight">Concept Glossary</h1>
        <p className="max-w-2xl text-sm font-semibold leading-relaxed">
          Search distributed systems concepts and jump directly into the
          scenario where each concept appears in a live simulation.
        </p>
      </header>

      <div className="mt-3 neo-panel bg-[var(--surface)] p-3">
        <label
          htmlFor="concept-search"
          className="text-xs font-black uppercase tracking-wide"
        >
          Search Concepts
        </label>
        <input
          id="concept-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          placeholder="Type concept, scenario, or keyword"
          className="mt-2 h-11 w-full border-2 border-[var(--border)] bg-[var(--background)] px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--main)]"
        />
      </div>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {filteredConcepts.map((concept) => (
          <li key={concept.id} className="neo-panel bg-[var(--surface)] p-3">
            <p className="text-base font-black">{concept.title}</p>
            <p className="mt-1 text-sm leading-relaxed">
              {concept.description}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              {concept.scenarioIds.map((scenarioId) => (
                <span
                  key={`${concept.id}-${scenarioId}`}
                  className="inline-flex border-2 border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[10px] font-black uppercase tracking-wide"
                >
                  {scenarioInfoById[scenarioId].title}
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/learn/$concept"
                params={{ concept: concept.id }}
                className="neo-panel inline-flex h-10 items-center justify-center bg-[var(--main)] px-3 text-xs font-black uppercase tracking-wide transition-transform duration-150 hover:-translate-x-[var(--box-shadow-x)] hover:-translate-y-[var(--box-shadow-y)] hover:shadow-none"
              >
                Open Concept
              </Link>
              <Link
                to={scenarioPathById[concept.scenarioIds[0] ?? "flash-sale"]}
                className="neo-panel inline-flex h-10 items-center justify-center bg-[var(--surface)] px-3 text-xs font-black uppercase tracking-wide"
              >
                See In Action
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getConceptGlossaryEntries,
  scenarioInfoById,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { Button } from "~/components/ui/button";

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
    <div className="space-y-5 py-2">
      <header className="space-y-2">
        <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          Learn Section
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Concept Glossary</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Search distributed systems concepts and jump directly into the
          scenario where each concept appears in a live simulation.
        </p>
      </header>

      <div className="card rounded-xl p-4">
        <label
          htmlFor="concept-search"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]"
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
          className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm outline-none transition-colors focus-visible:border-[var(--main)] focus-visible:ring-2 focus-visible:ring-[var(--main)]/20"
        />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {filteredConcepts.map((concept) => (
          <li key={concept.id} className="card card-interactive rounded-xl p-4">
            <p className="text-sm font-semibold">{concept.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {concept.description}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1">
              {concept.scenarioIds.map((scenarioId) => (
                <span
                  key={`${concept.id}-${scenarioId}`}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                >
                  {scenarioInfoById[scenarioId].title}
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/learn/$concept" params={{ concept: concept.id }}>
                  Open Concept
                </Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link
                  to={scenarioPathById[concept.scenarioIds[0] ?? "flash-sale"]}
                >
                  See In Action
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { PostMortem } from "~/components/trace/post-mortem";
import { StepCard } from "~/components/trace/step-card";
import { TraceFlowCanvas } from "~/components/trace/trace-flow-canvas";
import { TraceTimeline } from "~/components/trace/trace-timeline";
import { cn } from "~/lib/utils";
import type { ServiceName } from "~/lib/event-types";
import type { TraceResult, TraceScenarioId } from "~/lib/trace-types";

export const Route = createFileRoute("/trace/")({
  ssr: false,
  component: TracePage,
});

function resolveApiBaseUrl(): string {
  const configured = (
    import.meta.env as Record<string, string | undefined>
  ).VITE_SERVER_URL?.trim();

  if (configured) {
    return configured;
  }

  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//localhost:3001`;
  }

  return `${protocol}//${window.location.host}`;
}

type ScenarioOption = {
  id: TraceScenarioId;
  label: string;
  description: string;
  colorVar: string;
};

const scenarios: ScenarioOption[] = [
  {
    id: "flash-sale",
    label: "Flash Sale",
    description: "Rate limit → stock decrement → BullMQ → RabbitMQ fanout → Kafka → Postgres",
    colorVar: "--main",
  },
  {
    id: "ride-sharing",
    label: "Ride Sharing",
    description: "Redis geo search → BullMQ dispatch → RabbitMQ consumers → Kafka trip events → Postgres",
    colorVar: "--redis",
  },
  {
    id: "video-pipeline",
    label: "Video Pipeline",
    description: "Postgres intake → BullMQ parent/child jobs → RabbitMQ routing → Kafka → Postgres finalize",
    colorVar: "--bullmq",
  },
  {
    id: "banking",
    label: "Banking",
    description: "Idempotency + locks → Postgres SERIALIZABLE tx → RabbitMQ fraud RPC → Kafka ledger → Postgres audit",
    colorVar: "--rabbitmq",
  },
];

function TracePage() {
  const [selectedScenario, setSelectedScenario] =
    useState<TraceScenarioId>("flash-sale");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPostMortem, setShowPostMortem] = useState(false);

  const runTrace = useCallback(
    async (scenarioId: TraceScenarioId) => {
      setIsLoading(true);
      setError(null);
      setResult(null);
      setCurrentIndex(0);
      setShowPostMortem(false);

      try {
        const url = `${resolveApiBaseUrl()}/simulation/trace?scenario=${scenarioId}`;
        const response = await fetch(url, { method: "POST" });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = (await response.json()) as TraceResult;

        if (data.steps.length === 0) {
          throw new Error("No events captured — are the services running?");
        }

        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const currentStep = result?.steps[currentIndex] ?? null;

  const goNext = useCallback(() => {
    if (!result) return;
    const next = currentIndex + 1;
    if (next < result.steps.length) {
      setCurrentIndex(next);
    } else {
      setShowPostMortem(true);
    }
  }, [currentIndex, result]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowPostMortem(false);
    }
  }, [currentIndex]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[var(--foreground)]">
          Request Tracer
        </h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Watch one request travel through every service, step by step.
        </p>
      </div>

      {/* Scenario picker */}
      <div className="card rounded-xl p-3">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Choose scenario
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {scenarios.map((s) => {
            const isActive = selectedScenario === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedScenario(s.id)}
                disabled={isLoading}
                className={cn(
                  "card-inset rounded-lg p-2.5 text-left transition-all",
                  isActive
                    ? "ring-2"
                    : "hover:bg-[var(--surface)] opacity-70 hover:opacity-100",
                  "disabled:cursor-not-allowed",
                )}
                style={
                  isActive
                    ? { outline: `2px solid var(${s.colorVar})` }
                    : undefined
                }
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `var(${s.colorVar})` }}
                  />
                  <span className="text-xs font-semibold">{s.label}</span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
                  {s.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => void runTrace(selectedScenario)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--main)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Running trace…
              </>
            ) : (
              <>▷ Run Trace</>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="skeleton-wave h-[280px] rounded-xl bg-[var(--surface-2)]" />
          <div className="skeleton-wave h-[140px] rounded-xl bg-[var(--surface-2)]" />
          <div className="skeleton-wave h-16 rounded-xl bg-[var(--surface-2)]" />
          <p className="text-center text-xs text-[var(--muted)]">
            Running request through services — collecting events (≈3s)…
          </p>
        </div>
      ) : null}

      {/* Trace result */}
      {result && !isLoading ? (
        <>
          <TraceFlowCanvas
            activeSource={
              currentStep && !showPostMortem
                ? (currentStep.source as ServiceName)
                : null
            }
            activeTarget={
              currentStep && !showPostMortem
                ? ((currentStep.target as ServiceName | undefined) ?? null)
                : null
            }
          />

          {showPostMortem ? (
            <PostMortem
              result={result}
              onBackToSteps={() => {
                setShowPostMortem(false);
                setCurrentIndex(result.steps.length - 1);
              }}
              onRunAnother={() => void runTrace(selectedScenario)}
            />
          ) : currentStep ? (
            <>
              <StepCard
                step={currentStep}
                stepNumber={currentIndex + 1}
                total={result.steps.length}
                onPrev={goPrev}
                onNext={goNext}
              />

              <TraceTimeline
                steps={result.steps}
                currentIndex={currentIndex}
                onSelect={(index) => {
                  setCurrentIndex(index);
                  setShowPostMortem(false);
                }}
              />

              {currentIndex === result.steps.length - 1 ? (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setShowPostMortem(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    View Post-Mortem →
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* Empty state */}
      {!result && !isLoading && !error ? (
        <div className="card flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-2xl">
            🔭
          </div>
          <div>
            <p className="font-semibold text-[var(--foreground)]">
              No trace yet
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Select a scenario above and click "Run Trace" to execute one real
              request through all services — then step through each event.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

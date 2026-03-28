/* @jsxRuntime classic */
import * as React from "react";
import { useEffect, useState } from "react";
import { EventFeed } from "~/components/event-log/event-feed";
import { FlowCanvas } from "~/components/flow/flow-canvas";
import { ConceptCard } from "~/components/learning/concept-card";
import { ActivityBar } from "~/components/monitor/activity-bar";
import { Button } from "~/components/ui/button";
import { useFlowState } from "~/hooks/use-flow-state";
import { useSimulation } from "~/hooks/use-simulation";
import {
  conceptDefinitions,
  type ConceptDefinition,
} from "~/lib/learning-content";
import { useSimulationUi } from "~/lib/simulation-ui-context";

const connectionColorByState: Record<
  "connecting" | "open" | "closed" | "error",
  string
> = {
  connecting: "bg-amber-500",
  open: "bg-emerald-500",
  closed: "bg-zinc-500",
  error: "bg-red-500",
};

export function MainCanvasShell() {
  const {
    playbackRate,
    paused,
    stepCounter,
    setCurrentPhase,
    phaseJumpRequest,
    clearPhaseJumpRequest,
    whatIfEnabled,
    whatIfService,
    setFailureCount,
  } = useSimulationUi();
  const { events, bufferedCount, connectionState, clearEvents, jumpToPhase } =
    useSimulation({
      paused,
      playbackRate,
      stepCounter,
    });
  const { nodes, edges, metrics } = useFlowState(events);
  const [activeConcept, setActiveConcept] = useState<ConceptDefinition | null>(
    null,
  );
  const [shownConceptIds, setShownConceptIds] = useState<string[]>([]);

  useEffect(() => {
    if (phaseJumpRequest === null) {
      return;
    }

    jumpToPhase(phaseJumpRequest);
    clearPhaseJumpRequest();
  }, [clearPhaseJumpRequest, jumpToPhase, phaseJumpRequest]);

  useEffect(() => {
    const latestEvent = events[events.length - 1];
    if (!latestEvent || latestEvent.kind !== "phase.change") {
      return;
    }

    const phaseValue = latestEvent.data.phase;
    if (typeof phaseValue !== "number") {
      return;
    }

    const phase = Math.min(4, Math.max(1, Math.trunc(phaseValue)));
    setCurrentPhase(phase);
  }, [events, setCurrentPhase]);

  useEffect(() => {
    if (!whatIfEnabled) {
      setFailureCount(0);
      return;
    }

    const count = events.filter((event) => {
      if (event.source !== whatIfService) {
        return false;
      }

      return (
        event.kind === "request.rejected" ||
        event.kind === "bullmq.job.failed" ||
        event.kind === "bullmq.job.dlq"
      );
    }).length;

    setFailureCount(count);
  }, [events, setFailureCount, whatIfEnabled, whatIfService]);

  useEffect(() => {
    const latestEvent = events[events.length - 1];
    if (!latestEvent) {
      return;
    }

    const concept = conceptDefinitions.find((entry) => {
      if (!entry.triggerKinds.includes(latestEvent.kind)) {
        return false;
      }

      return !shownConceptIds.includes(entry.id);
    });

    if (!concept) {
      return;
    }

    setShownConceptIds((previous) => [...previous, concept.id]);
    setActiveConcept(concept);
  }, [events, shownConceptIds]);

  return (
    <section className="neo-panel grid min-h-[60dvh] grid-rows-[1fr,auto,auto] gap-3 bg-[var(--background)] p-3">
      <div className="neo-panel relative overflow-hidden bg-[var(--surface)] p-4">
        <div className="absolute -top-16 right-8 h-40 w-40 rounded-full bg-[var(--main)]/25 blur-2xl" />
        <div className="absolute -bottom-14 left-8 h-32 w-32 rounded-full bg-[var(--rabbitmq)]/35 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black uppercase tracking-wide">
            Architecture Flow Canvas
          </h2>
          <div className="flex items-center gap-2">
            <span className="neo-panel inline-flex items-center gap-2 bg-[var(--background)] px-2 py-1 text-[11px] font-black uppercase">
              <span
                className={`h-2.5 w-2.5 rounded-full ${connectionColorByState[connectionState]}`}
              />
              ws {connectionState}
            </span>
            <span className="neo-panel bg-[var(--background)] px-2 py-1 text-[11px] font-black uppercase">
              buffered {bufferedCount}
            </span>
            <Button size="sm" variant="ghost" onClick={clearEvents}>
              Clear Log
            </Button>
          </div>
        </div>

        <div
          className={`relative z-10 mt-4 ${whatIfEnabled ? "what-if-failure" : ""}`}
        >
          <FlowCanvas nodes={nodes} edges={edges} />
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 z-20">
          <ConceptCard
            concept={activeConcept}
            onDismiss={() => {
              setActiveConcept(null);
            }}
          />
        </div>
      </div>

      <ActivityBar metrics={metrics} events={events} />

      <EventFeed events={events} />
    </section>
  );
}

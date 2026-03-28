/* @jsxRuntime classic */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { EventFeed } from "~/components/event-log/event-feed";
import { FlowCanvas } from "~/components/flow/flow-canvas";
import { ConceptCard } from "~/components/learning/concept-card";
import { ActivityBar } from "~/components/monitor/activity-bar";
import { Button } from "~/components/ui/button";
import { useFlowState } from "~/hooks/use-flow-state";
import { useSimulation } from "~/hooks/use-simulation";
import {
  getScenarioLearningContent,
  type ConceptDefinition,
  type SupportedScenarioId,
} from "~/lib/learning-content";
import { useSimulationUi } from "~/lib/simulation-ui-context";
import type { SimulationEvent } from "~/lib/event-types";

const connectionColorByState: Record<
  "connecting" | "open" | "closed" | "error",
  string
> = {
  connecting: "bg-amber-500",
  open: "bg-emerald-500",
  closed: "bg-zinc-500",
  error: "bg-red-500",
};

type RideDriverPoint = {
  driverId: string;
  x: number;
  y: number;
};

type RideOverlaySnapshot = {
  driverPoints: RideDriverPoint[];
  latestCountdownSec: number | null;
  latestConsumerId: string | null;
  latestRadiusKm: number | null;
  latestAttempt: number | null;
};

function buildRideOverlaySnapshot(
  events: SimulationEvent[],
): RideOverlaySnapshot {
  const driverCoordinates = new Map<
    string,
    { longitude: number; latitude: number }
  >();

  for (const event of events) {
    if (event.kind !== "redis.op") {
      continue;
    }

    const operation = event.data.operation;
    const driverId = event.data.driverId;
    const longitude = event.data.longitude;
    const latitude = event.data.latitude;

    if (
      operation !== "GEOADD" ||
      typeof driverId !== "string" ||
      typeof longitude !== "number" ||
      typeof latitude !== "number"
    ) {
      continue;
    }

    driverCoordinates.set(driverId, {
      longitude,
      latitude,
    });
  }

  const coordinateEntries = Array.from(driverCoordinates.entries());
  const longitudes = coordinateEntries.map(([, value]) => value.longitude);
  const latitudes = coordinateEntries.map(([, value]) => value.latitude);

  const minLongitude = longitudes.length > 0 ? Math.min(...longitudes) : -1;
  const maxLongitude = longitudes.length > 0 ? Math.max(...longitudes) : 1;
  const minLatitude = latitudes.length > 0 ? Math.min(...latitudes) : -1;
  const maxLatitude = latitudes.length > 0 ? Math.max(...latitudes) : 1;

  const longitudeSpan = Math.max(0.0001, maxLongitude - minLongitude);
  const latitudeSpan = Math.max(0.0001, maxLatitude - minLatitude);

  const driverPoints = coordinateEntries.map(([driverId, position]) => ({
    driverId,
    x: ((position.longitude - minLongitude) / longitudeSpan) * 100,
    y: 100 - ((position.latitude - minLatitude) / latitudeSpan) * 100,
  }));

  let latestCountdownSec: number | null = null;
  let latestConsumerId: string | null = null;
  let latestRadiusKm: number | null = null;
  let latestAttempt: number | null = null;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) {
      continue;
    }

    if (
      latestCountdownSec === null &&
      event.kind === "bullmq.job.progress" &&
      event.data.step === "dispatch_timeout" &&
      typeof event.data.timeRemainingSec === "number"
    ) {
      latestCountdownSec = event.data.timeRemainingSec;
    }

    if (
      latestConsumerId === null &&
      event.kind === "rabbitmq.consumed" &&
      typeof event.data.consumerId === "string"
    ) {
      latestConsumerId = event.data.consumerId;
    }

    if (
      (latestRadiusKm === null || latestAttempt === null) &&
      event.kind === "bullmq.job.created"
    ) {
      if (
        latestRadiusKm === null &&
        typeof event.data.searchRadiusKm === "number"
      ) {
        latestRadiusKm = event.data.searchRadiusKm;
      }

      if (latestAttempt === null && typeof event.data.attempt === "number") {
        latestAttempt = event.data.attempt;
      }
    }

    if (
      latestCountdownSec !== null &&
      latestConsumerId !== null &&
      latestRadiusKm !== null &&
      latestAttempt !== null
    ) {
      break;
    }
  }

  return {
    driverPoints,
    latestCountdownSec,
    latestConsumerId,
    latestRadiusKm,
    latestAttempt,
  };
}

function RideSharingOverlay({ events }: { events: SimulationEvent[] }) {
  const snapshot = useMemo(() => buildRideOverlaySnapshot(events), [events]);

  return (
    <section className="neo-panel mt-3 grid gap-2 bg-[var(--surface)] p-2 sm:grid-cols-[1fr,220px]">
      <div>
        <p className="text-[11px] font-black uppercase tracking-wide">
          Dispatch Timeout
        </p>
        <p className="text-sm font-black">
          {snapshot.latestCountdownSec === null
            ? "Waiting for dispatch"
            : `${snapshot.latestCountdownSec}s remaining`}
        </p>
        <p className="mt-1 text-xs">
          Radius{" "}
          {snapshot.latestRadiusKm === null
            ? "-"
            : `${snapshot.latestRadiusKm.toFixed(1)}km`}
          {" · "}
          Attempt {snapshot.latestAttempt ?? "-"}
        </p>
        <p className="mt-1 text-xs">
          Winning consumer: {snapshot.latestConsumerId ?? "pending"}
        </p>
      </div>

      <div className="neo-panel relative h-24 overflow-hidden bg-[var(--background)]">
        <div className="absolute inset-2 rounded-sm border-2 border-dashed border-[var(--border)]/60" />
        {snapshot.driverPoints.map((point) => (
          <span
            key={point.driverId}
            className="absolute h-2 w-2 rounded-full border border-[var(--border)] bg-[var(--redis)]"
            style={{
              left: `calc(${point.x}% - 4px)`,
              top: `calc(${point.y}% - 4px)`,
            }}
          />
        ))}
        <p className="absolute bottom-1 right-1 text-[10px] font-black uppercase">
          drivers {snapshot.driverPoints.length}
        </p>
      </div>
    </section>
  );
}

export function MainCanvasShell({
  scenarioId,
}: {
  scenarioId: SupportedScenarioId;
}) {
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
  const scenarioContent = useMemo(
    () => getScenarioLearningContent(scenarioId),
    [scenarioId],
  );
  const { events, bufferedCount, connectionState, clearEvents, jumpToPhase } =
    useSimulation({
      paused,
      playbackRate,
      stepCounter,
      scenarioId,
    });
  const { nodes, edges, metrics } = useFlowState(events);
  const [activeConcept, setActiveConcept] = useState<ConceptDefinition | null>(
    null,
  );
  const [shownConceptIds, setShownConceptIds] = useState<string[]>([]);

  useEffect(() => {
    setCurrentPhase(1);
    setShownConceptIds([]);
    setActiveConcept(null);
  }, [scenarioId, setCurrentPhase]);

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

    const phaseMax = scenarioContent.phases.length;
    const phase = Math.min(phaseMax, Math.max(1, Math.trunc(phaseValue)));
    setCurrentPhase(phase);
  }, [events, scenarioContent.phases.length, setCurrentPhase]);

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

    const concept = scenarioContent.conceptDefinitions.find((entry) => {
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
  }, [events, scenarioContent.conceptDefinitions, shownConceptIds]);

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

        {scenarioId === "ride-sharing" ? (
          <RideSharingOverlay events={events} />
        ) : null}

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

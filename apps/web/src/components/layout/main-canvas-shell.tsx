/* @jsxRuntime classic */
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { EventFeed } from "~/components/event-log/event-feed";
import { FlowCanvas } from "~/components/flow/flow-canvas";
import { ConceptCard } from "~/components/learning/concept-card";
import { SummaryCard } from "~/components/learning/summary-card";
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

const videoRenditions = ["240p", "360p", "720p", "1080p", "4k"] as const;
type VideoRendition = (typeof videoRenditions)[number];

type VideoConsumerStat = {
  consumerGroup: string;
  consumedCount: number;
  averageLatencyMs: number;
};

type VideoRoutingPath = {
  routingKey: string;
  queue: string;
};

type VideoOverlaySnapshot = {
  progressByRendition: Record<VideoRendition, number>;
  dlqRenditions: VideoRendition[];
  routingPaths: VideoRoutingPath[];
  consumerStats: VideoConsumerStat[];
};

type BankingOverlaySnapshot = {
  idempotencySetAttempts: number;
  duplicateBounces: number;
  txBegins: number;
  txCommits: number;
  publisherConfirmAcks: number;
  reviewQueued: number;
  reviewCompleted: number;
  latestReviewCountdownSec: number | null;
  replicaWrites: number;
  auditReads: number;
};

function isVideoRendition(value: string): value is VideoRendition {
  return videoRenditions.includes(value as VideoRendition);
}

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

function buildVideoPipelineOverlaySnapshot(
  events: SimulationEvent[],
): VideoOverlaySnapshot {
  const progressByRendition: Record<VideoRendition, number> = {
    "240p": 0,
    "360p": 0,
    "720p": 0,
    "1080p": 0,
    "4k": 0,
  };

  const dlqRenditions = new Set<VideoRendition>();
  const routingPathMap = new Map<string, VideoRoutingPath>();
  const consumerStats = new Map<
    string,
    { consumedCount: number; latencyTotal: number }
  >();

  for (const event of events) {
    const workflow = event.data.workflow;
    const renditionRaw = event.data.rendition;
    const rendition =
      typeof renditionRaw === "string" && isVideoRendition(renditionRaw)
        ? renditionRaw
        : null;

    if (
      event.kind === "bullmq.job.progress" &&
      workflow === "video-child" &&
      rendition
    ) {
      const progress = event.data.progress;
      if (typeof progress === "number") {
        progressByRendition[rendition] = Math.max(
          progressByRendition[rendition],
          Math.trunc(progress),
        );
      }
      continue;
    }

    if (
      event.kind === "bullmq.job.completed" &&
      workflow === "video-child" &&
      rendition
    ) {
      progressByRendition[rendition] = 100;
      continue;
    }

    if (
      event.kind === "bullmq.job.dlq" &&
      workflow === "video-child" &&
      rendition
    ) {
      dlqRenditions.add(rendition);
      continue;
    }

    if (event.kind === "rabbitmq.routed") {
      const routingKey = event.data.routingKey;
      const queue = event.data.queue;
      if (typeof routingKey === "string" && typeof queue === "string") {
        routingPathMap.set(routingKey, {
          routingKey,
          queue,
        });
      }
      continue;
    }

    if (event.kind === "kafka.consumed") {
      const consumerGroup = event.data.consumerGroup;
      if (typeof consumerGroup !== "string") {
        continue;
      }

      const previous = consumerStats.get(consumerGroup) ?? {
        consumedCount: 0,
        latencyTotal: 0,
      };

      consumerStats.set(consumerGroup, {
        consumedCount: previous.consumedCount + 1,
        latencyTotal: previous.latencyTotal + event.latencyMs,
      });
    }
  }

  return {
    progressByRendition,
    dlqRenditions: Array.from(dlqRenditions),
    routingPaths: Array.from(routingPathMap.values()),
    consumerStats: Array.from(consumerStats.entries())
      .map(([consumerGroup, value]) => ({
        consumerGroup,
        consumedCount: value.consumedCount,
        averageLatencyMs:
          value.consumedCount > 0
            ? Math.round(value.latencyTotal / value.consumedCount)
            : 0,
      }))
      .sort((left, right) => left.averageLatencyMs - right.averageLatencyMs),
  };
}

function VideoPipelineOverlay({ events }: { events: SimulationEvent[] }) {
  const snapshot = useMemo(
    () => buildVideoPipelineOverlaySnapshot(events),
    [events],
  );

  return (
    <section className="neo-panel mt-3 grid gap-2 bg-[var(--surface)] p-2 lg:grid-cols-[1.4fr,1fr]">
      <article className="neo-panel bg-[var(--background)] p-2">
        <p className="text-[11px] font-black uppercase tracking-wide">
          Parent-Child Rendition Progress
        </p>
        <div className="mt-2 space-y-2">
          {videoRenditions.map((rendition) => {
            const progress = snapshot.progressByRendition[rendition];
            const inDlq = snapshot.dlqRenditions.includes(rendition);

            return (
              <div key={rendition} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase">
                  <span>{rendition}</span>
                  <span>{inDlq ? "dlq" : `${progress}%`}</span>
                </div>
                <div className="h-2 overflow-hidden border-2 border-[var(--border)] bg-[var(--background)]">
                  <div
                    className={`${inDlq ? "bg-red-500" : "bg-[var(--bullmq)]"} h-full transition-[width] duration-200`}
                    style={{ width: `${inDlq ? 100 : progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs font-black uppercase tracking-wide">
          DLQ Graveyard:{" "}
          {snapshot.dlqRenditions.length > 0
            ? snapshot.dlqRenditions.join(", ")
            : "none"}
        </p>
      </article>

      <article className="grid gap-2">
        <div className="neo-panel bg-[var(--background)] p-2">
          <p className="text-[11px] font-black uppercase tracking-wide">
            RabbitMQ Routing Keys
          </p>
          <div className="mt-2 space-y-1 text-xs">
            {snapshot.routingPaths.length === 0 ? (
              <p>Waiting for routing events</p>
            ) : (
              snapshot.routingPaths.map((path) => (
                <p key={path.routingKey} className="font-semibold">
                  {path.routingKey} -&gt; {path.queue}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="neo-panel bg-[var(--background)] p-2">
          <p className="text-[11px] font-black uppercase tracking-wide">
            Kafka Consumer Speeds
          </p>
          <div className="mt-2 space-y-1 text-xs">
            {snapshot.consumerStats.length === 0 ? (
              <p>Waiting for consumer activity</p>
            ) : (
              snapshot.consumerStats.map((entry) => (
                <p key={entry.consumerGroup} className="font-semibold">
                  {entry.consumerGroup}: {entry.consumedCount} events,{" "}
                  {entry.averageLatencyMs}ms avg
                </p>
              ))
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

function buildBankingOverlaySnapshot(
  events: SimulationEvent[],
): BankingOverlaySnapshot {
  let idempotencySetAttempts = 0;
  let duplicateBounces = 0;
  let txBegins = 0;
  let txCommits = 0;
  let publisherConfirmAcks = 0;
  let reviewQueued = 0;
  let reviewCompleted = 0;
  let latestReviewCountdownSec: number | null = null;
  let replicaWrites = 0;
  let auditReads = 0;

  for (const event of events) {
    if (event.kind === "redis.op") {
      if (
        event.data.operation === "SETNX" &&
        typeof event.data.key === "string" &&
        event.data.key.startsWith("banking:idempotency:")
      ) {
        idempotencySetAttempts += 1;
      }
      continue;
    }

    if (
      event.kind === "request.rejected" &&
      event.data.reason === "duplicate_request"
    ) {
      duplicateBounces += 1;
      continue;
    }

    if (event.kind === "postgres.tx.begin") {
      if (typeof event.data.transferId === "string") {
        txBegins += 1;
      }
      continue;
    }

    if (event.kind === "postgres.tx.commit") {
      if (typeof event.data.transferId === "string") {
        txCommits += 1;
      }
      continue;
    }

    if (
      event.kind === "rabbitmq.ack" &&
      event.data.ackType === "publisher_confirm"
    ) {
      publisherConfirmAcks += 1;
      continue;
    }

    if (
      event.kind === "bullmq.job.created" &&
      event.data.workflow === "banking-review"
    ) {
      reviewQueued += 1;
      continue;
    }

    if (
      event.kind === "bullmq.job.completed" &&
      event.data.workflow === "banking-review"
    ) {
      reviewCompleted += 1;
      continue;
    }

    if (
      event.kind === "bullmq.job.progress" &&
      event.data.workflow === "banking-review" &&
      event.data.step === "review_hold" &&
      typeof event.data.timeRemainingSec === "number"
    ) {
      latestReviewCountdownSec = event.data.timeRemainingSec;
      continue;
    }

    if (event.kind === "kafka.produced") {
      const detail = event.data.detail;
      if (
        typeof detail === "string" &&
        detail.startsWith("replica.sync.node_")
      ) {
        replicaWrites += 1;
      }
      continue;
    }

    if (
      event.kind === "postgres.query" &&
      event.data.query === "read_banking_audit_ledger"
    ) {
      auditReads += 1;
    }
  }

  return {
    idempotencySetAttempts,
    duplicateBounces,
    txBegins,
    txCommits,
    publisherConfirmAcks,
    reviewQueued,
    reviewCompleted,
    latestReviewCountdownSec,
    replicaWrites,
    auditReads,
  };
}

function BankingOverlay({ events }: { events: SimulationEvent[] }) {
  const snapshot = useMemo(() => buildBankingOverlaySnapshot(events), [events]);

  const inFlightTransactions = Math.max(
    0,
    snapshot.txBegins - snapshot.txCommits,
  );
  const reviewDepth = Math.max(
    0,
    snapshot.reviewQueued - snapshot.reviewCompleted,
  );
  const replicaPerNode = Math.ceil(snapshot.replicaWrites / 3);

  return (
    <section className="neo-panel mt-3 grid gap-2 bg-[var(--surface)] p-2 lg:grid-cols-[1.2fr,1fr,1fr]">
      <article className="neo-panel bg-[var(--background)] p-2">
        <p className="text-[11px] font-black uppercase tracking-wide">
          Idempotency + Serializable Gate
        </p>
        <p className="mt-1 text-xs font-semibold">
          SETNX attempts: {snapshot.idempotencySetAttempts}
        </p>
        <p className="text-xs font-semibold">
          Duplicate bounces: {snapshot.duplicateBounces}
        </p>
        <p className="text-xs font-semibold">TX begin: {snapshot.txBegins}</p>
        <p className="text-xs font-semibold">TX commit: {snapshot.txCommits}</p>
        <p className="mt-1 text-xs font-black uppercase tracking-wide">
          In-flight transaction blocks: {inFlightTransactions}
        </p>
      </article>

      <article className="neo-panel bg-[var(--background)] p-2">
        <p className="text-[11px] font-black uppercase tracking-wide">
          Fraud Hold Review Queue
        </p>
        <p className="mt-1 text-xs font-semibold">
          Publisher confirms: {snapshot.publisherConfirmAcks}
        </p>
        <p className="text-xs font-semibold">
          Queued reviews: {snapshot.reviewQueued}
        </p>
        <p className="text-xs font-semibold">
          Completed reviews: {snapshot.reviewCompleted}
        </p>
        <p className="text-xs font-semibold">Queue depth: {reviewDepth}</p>
        <p className="mt-1 text-xs font-black uppercase tracking-wide">
          Countdown: {snapshot.latestReviewCountdownSec ?? "-"}
          {snapshot.latestReviewCountdownSec === null ? "" : "s"}
        </p>
      </article>

      <article className="neo-panel bg-[var(--background)] p-2">
        <p className="text-[11px] font-black uppercase tracking-wide">
          Kafka Replication + Audit
        </p>
        <p className="mt-1 text-xs font-semibold">
          Replica writes: {snapshot.replicaWrites}
        </p>
        <p className="text-xs font-semibold">
          Per replica node: {replicaPerNode}
        </p>
        <p className="text-xs font-semibold">
          Audit reads: {snapshot.auditReads}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          <div className="neo-panel bg-[var(--kafka)]/30 p-1 text-center text-[10px] font-black uppercase">
            R1
          </div>
          <div className="neo-panel bg-[var(--kafka)]/30 p-1 text-center text-[10px] font-black uppercase">
            R2
          </div>
          <div className="neo-panel bg-[var(--kafka)]/30 p-1 text-center text-[10px] font-black uppercase">
            R3
          </div>
        </div>
      </article>
    </section>
  );
}

function useThrottledEvents(
  events: SimulationEvent[],
  throttleMs: number,
): SimulationEvent[] {
  const [throttledEvents, setThrottledEvents] =
    useState<SimulationEvent[]>(events);

  useEffect(() => {
    const timeoutHandle = setTimeout(() => {
      setThrottledEvents(events);
    }, throttleMs);

    return () => {
      clearTimeout(timeoutHandle);
    };
  }, [events, throttleMs]);

  return throttledEvents;
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
  const throttledFlowEvents = useThrottledEvents(events, 120);
  const { nodes, edges, metrics } = useFlowState(
    throttledFlowEvents,
    scenarioId,
  );
  const [activeConcept, setActiveConcept] = useState<ConceptDefinition | null>(
    null,
  );
  const [shownConceptIds, setShownConceptIds] = useState<string[]>([]);

  const showLoadingState =
    connectionState === "connecting" && events.length === 0;
  const showConnectionError =
    connectionState === "error" || connectionState === "closed";
  const scenarioCompleted = events.some(
    (event) => event.kind === "scenario.complete",
  );

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
    if (connectionState !== "open") {
      return;
    }

    const phaseParam = new URLSearchParams(window.location.search).get("phase");
    if (!phaseParam) {
      return;
    }

    const parsedPhase = Number(phaseParam);
    if (!Number.isFinite(parsedPhase)) {
      return;
    }

    const safePhase = Math.max(1, Math.trunc(parsedPhase));
    jumpToPhase(safePhase);
  }, [connectionState, jumpToPhase, scenarioId]);

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
    <section className="neo-panel scenario-shell-enter grid min-h-[60dvh] grid-rows-[1fr,auto,auto,auto] gap-3 bg-[var(--background)] p-3">
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

        {showConnectionError ? (
          <div
            role="alert"
            className="neo-panel relative z-10 mt-3 bg-red-500/20 px-3 py-2 text-xs font-black uppercase tracking-wide"
          >
            Backend disconnected. Start server and infrastructure to resume live
            simulation.
          </div>
        ) : null}

        {scenarioId === "ride-sharing" ? (
          <RideSharingOverlay events={events} />
        ) : null}

        {scenarioId === "video-pipeline" ? (
          <VideoPipelineOverlay events={events} />
        ) : null}

        {scenarioId === "banking" ? <BankingOverlay events={events} /> : null}

        {showLoadingState ? (
          <div className="neo-panel skeleton-wave relative z-10 mt-4 h-[460px] bg-[var(--background)]" />
        ) : (
          <div
            className={`relative z-10 mt-4 ${whatIfEnabled ? "what-if-failure" : ""}`}
          >
            <FlowCanvas nodes={nodes} edges={edges} />
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 right-3 z-20">
          <ConceptCard
            concept={activeConcept}
            onDismiss={() => {
              setActiveConcept(null);
            }}
          />
        </div>
      </div>

      <SummaryCard
        scenarioId={scenarioId}
        events={events}
        isVisible={scenarioCompleted}
      />

      {showLoadingState ? (
        <section className="neo-panel skeleton-wave h-28 bg-[var(--surface)]" />
      ) : (
        <ActivityBar metrics={metrics} events={throttledFlowEvents} />
      )}

      <EventFeed events={events} />
    </section>
  );
}

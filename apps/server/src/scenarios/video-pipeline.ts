import { emitSimulationEvent, onSimulationEvent } from "../events/emitter";
import type { SimulationContext, SimulationEvent } from "../events/types";
import {
  enqueueVideoPipelineChildJob,
  enqueueVideoPipelineParentJob,
} from "../services/bullmq";
import { produceKafkaEvent } from "../services/kafka";
import {
  runVideoPipelineFinalize,
  runVideoPipelineUploadIntake,
} from "../services/postgres";
import { publishVideoPipelineMessage } from "../services/rabbitmq";
import { deleteRedisKey, setExpiringRedisValue } from "../services/redis";

const scenarioName = "video-pipeline";
const kafkaTopic = "video-pipeline-events" as const;
const renditionProfiles = ["240p", "360p", "720p", "1080p", "4k"] as const;
const forcedFailRendition = "1080p" as const;
const progressTtlSeconds = 90;
const defaultUploadTarget = 6;
const uploadIngestionIntervalMs = 1_250;

type RenditionName = (typeof renditionProfiles)[number];

type VideoPipelineStatus = {
  running: boolean;
  uploadTarget: number;
  totalUploads: number;
  parentJobsCreated: number;
  childJobsCreated: number;
  childJobsCompleted: number;
  childJobsFailed: number;
  dlqJobs: number;
  routingMessages: number;
  kafkaProduced: number;
  finalizedUploads: number;
  currentPhase: number;
};

type ChildRequestMeta = {
  uploadId: string;
  rendition: RenditionName;
  progressKey: string;
};

type UploadState = {
  uploadId: string;
  parentRequestId: string;
  parentJobId: string;
  progressKeys: Record<RenditionName, string>;
  completedRenditions: Set<RenditionName>;
  failedRenditions: Set<RenditionName>;
  dlqRenditions: Set<RenditionName>;
  routed: boolean;
  routeInFlight: boolean;
  finalized: boolean;
  finalizeInFlight: boolean;
};

let running = false;
let uploadTarget = defaultUploadTarget;
let totalUploads = 0;
let parentJobsCreated = 0;
let childJobsCreated = 0;
let childJobsCompleted = 0;
let childJobsFailed = 0;
let dlqJobs = 0;
let routingMessages = 0;
let kafkaProduced = 0;
let finalizedUploads = 0;
let currentPhase = 0;
let ingestionBusy = false;
let forcedPhase: number | null = null;
let ingestionTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeFromBus: (() => void) | null = null;

const uploadsById = new Map<string, UploadState>();
const childRequestsById = new Map<string, ChildRequestMeta>();

function buildContext(requestId: string, phase: number): SimulationContext {
  return {
    scenario: scenarioName,
    phase,
    requestId,
  };
}

function isRenditionName(value: string): value is RenditionName {
  return renditionProfiles.includes(value as RenditionName);
}

function parseStringData(event: SimulationEvent, key: string): string | null {
  const value = event.data[key];
  return typeof value === "string" ? value : null;
}

function parseNumberData(event: SimulationEvent, key: string): number | null {
  const value = event.data[key];
  return typeof value === "number" ? value : null;
}

function parseBooleanData(event: SimulationEvent, key: string): boolean | null {
  const value = event.data[key];
  return typeof value === "boolean" ? value : null;
}

function emitPhaseChange(phase: number, title: string): void {
  if (phase === currentPhase) {
    return;
  }

  currentPhase = phase;
  emitSimulationEvent({
    scenario: scenarioName,
    phase,
    kind: "phase.change",
    source: "elysia",
    target: "postgres",
    data: {
      phase,
      title,
    },
    latencyMs: 0,
    description: title,
  });
}

function stopIngestionTimer(): void {
  if (!ingestionTimer) {
    return;
  }

  clearInterval(ingestionTimer);
  ingestionTimer = null;
}

function buildProgressKey(uploadId: string, rendition: RenditionName): string {
  return `video-pipeline:progress:${uploadId}:${rendition}`;
}

function resolvePreferredRendition(
  completedRenditions: Set<RenditionName>,
): RenditionName {
  const priorityOrder: RenditionName[] = ["4k", "1080p", "720p", "360p", "240p"];

  for (const rendition of priorityOrder) {
    if (completedRenditions.has(rendition)) {
      return rendition;
    }
  }

  return "240p";
}

async function maybeCompleteScenario(): Promise<void> {
  if (!running) {
    return;
  }

  if (totalUploads < uploadTarget) {
    return;
  }

  if (finalizedUploads < totalUploads) {
    return;
  }

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 5,
    kind: "scenario.complete",
    source: "elysia",
    data: {
      uploadTarget,
      totalUploads,
      parentJobsCreated,
      childJobsCreated,
      childJobsCompleted,
      childJobsFailed,
      dlqJobs,
      routingMessages,
      kafkaProduced,
      finalizedUploads,
    },
    latencyMs: 0,
    description: "Video pipeline scenario complete",
  });

  running = false;
  ingestionBusy = false;
  forcedPhase = null;
  stopIngestionTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

async function finalizeUpload(
  uploadState: UploadState,
  requestId: string,
): Promise<void> {
  if (uploadState.finalized || uploadState.finalizeInFlight) {
    return;
  }

  uploadState.finalizeInFlight = true;

  try {
    emitPhaseChange(5, "Phase 5 activated: finalize database state and cleanup");

    await runVideoPipelineFinalize(buildContext(requestId, 5), {
      uploadId: uploadState.uploadId,
      renditionsCompleted: uploadState.completedRenditions.size,
      renditionsFailed: uploadState.dlqRenditions.size,
      published: true,
      failureReason:
        uploadState.dlqRenditions.size > 0
          ? `${uploadState.dlqRenditions.size}_renditions_in_dlq`
          : null,
    });

    for (const rendition of renditionProfiles) {
      const cleanupRequestId = `${requestId}:cleanup:${rendition}`;
      await deleteRedisKey(
        uploadState.progressKeys[rendition],
        buildContext(cleanupRequestId, 5),
        "postgres",
      );
    }

    uploadState.finalized = true;
    finalizedUploads += 1;

    await maybeCompleteScenario();
  } finally {
    uploadState.finalizeInFlight = false;
  }
}

async function maybeRouteUpload(uploadState: UploadState): Promise<void> {
  if (uploadState.routed || uploadState.routeInFlight) {
    return;
  }

  const settledCount =
    uploadState.completedRenditions.size + uploadState.dlqRenditions.size;
  if (settledCount < renditionProfiles.length) {
    return;
  }

  uploadState.routeInFlight = true;

  try {
    emitPhaseChange(4, "Phase 4 activated: routing completion events");

    const preferredRendition = resolvePreferredRendition(
      uploadState.completedRenditions,
    );

    await publishVideoPipelineMessage(
      buildContext(`${uploadState.uploadId}:route:cdn`, 4),
      {
        uploadId: uploadState.uploadId,
        rendition: preferredRendition,
        routingKey: "video.cdn.ready",
        detail: "cdn_publish",
      },
    );
    routingMessages += 1;

    await publishVideoPipelineMessage(
      buildContext(`${uploadState.uploadId}:route:search`, 4),
      {
        uploadId: uploadState.uploadId,
        rendition: preferredRendition,
        routingKey: "video.search.index",
        detail: "search_index",
      },
    );
    routingMessages += 1;

    await publishVideoPipelineMessage(
      buildContext(`${uploadState.uploadId}:route:notify`, 4),
      {
        uploadId: uploadState.uploadId,
        rendition: preferredRendition,
        routingKey: "video.notify.ready",
        detail: "subscriber_notify",
      },
    );
    routingMessages += 1;

    await produceKafkaEvent(
      buildContext(`${uploadState.uploadId}:kafka:video_published`, 4),
      `video.published:${uploadState.uploadId}:completed=${uploadState.completedRenditions.size}:failed=${uploadState.dlqRenditions.size}`,
      kafkaTopic,
    );
    kafkaProduced += 1;

    uploadState.routed = true;

    await finalizeUpload(
      uploadState,
      `${uploadState.uploadId}:finalize:pipeline_summary`,
    );
  } finally {
    uploadState.routeInFlight = false;
  }
}

async function handleVideoChildProgress(event: SimulationEvent): Promise<void> {
  if (parseStringData(event, "workflow") !== "video-child") {
    return;
  }

  const requestId = parseStringData(event, "requestId");
  const progress = parseNumberData(event, "progress");
  if (!requestId || progress === null) {
    return;
  }

  const childMeta = childRequestsById.get(requestId);
  if (!childMeta) {
    return;
  }

  await setExpiringRedisValue(
    childMeta.progressKey,
    String(progress),
    progressTtlSeconds,
    buildContext(requestId, 2),
    "bullmq",
  );
}

async function handleVideoChildCompleted(event: SimulationEvent): Promise<void> {
  if (parseStringData(event, "workflow") !== "video-child") {
    return;
  }

  const requestId = parseStringData(event, "requestId");
  const uploadId = parseStringData(event, "uploadId");
  const renditionRaw = parseStringData(event, "rendition");

  if (!requestId || !uploadId || !renditionRaw || !isRenditionName(renditionRaw)) {
    return;
  }

  const uploadState = uploadsById.get(uploadId);
  if (!uploadState || uploadState.completedRenditions.has(renditionRaw)) {
    return;
  }

  uploadState.completedRenditions.add(renditionRaw);
  childJobsCompleted += 1;

  await setExpiringRedisValue(
    uploadState.progressKeys[renditionRaw],
    "100",
    progressTtlSeconds,
    buildContext(requestId, 2),
    "rabbitmq",
  );

  await maybeRouteUpload(uploadState);
}

async function handleVideoChildFailed(event: SimulationEvent): Promise<void> {
  if (parseStringData(event, "workflow") !== "video-child") {
    return;
  }

  const requestId = parseStringData(event, "requestId");
  const uploadId = parseStringData(event, "uploadId");
  const renditionRaw = parseStringData(event, "rendition");
  const finalFailure = parseBooleanData(event, "finalFailure");

  if (
    !requestId ||
    !uploadId ||
    !renditionRaw ||
    !isRenditionName(renditionRaw) ||
    finalFailure !== true
  ) {
    return;
  }

  const uploadState = uploadsById.get(uploadId);
  if (!uploadState || uploadState.failedRenditions.has(renditionRaw)) {
    return;
  }

  emitPhaseChange(3, "Phase 3 activated: failed child to DLQ while others continue");

  uploadState.failedRenditions.add(renditionRaw);
  childJobsFailed += 1;

  await setExpiringRedisValue(
    uploadState.progressKeys[renditionRaw],
    "-1",
    progressTtlSeconds,
    buildContext(requestId, 3),
    "bullmq",
  );
}

async function handleVideoChildDlq(event: SimulationEvent): Promise<void> {
  if (parseStringData(event, "workflow") !== "video-child") {
    return;
  }

  const requestId = parseStringData(event, "requestId");
  const uploadId = parseStringData(event, "uploadId");
  const renditionRaw = parseStringData(event, "rendition");

  if (!requestId || !uploadId || !renditionRaw || !isRenditionName(renditionRaw)) {
    return;
  }

  const uploadState = uploadsById.get(uploadId);
  if (!uploadState || uploadState.dlqRenditions.has(renditionRaw)) {
    return;
  }

  uploadState.dlqRenditions.add(renditionRaw);
  dlqJobs += 1;

  await maybeRouteUpload(uploadState);
}

function registerEventHandlers(): void {
  unsubscribeFromBus = onSimulationEvent((event) => {
    if (!running || event.scenario !== scenarioName) {
      return;
    }

    if (event.kind === "bullmq.job.progress") {
      void handleVideoChildProgress(event);
      return;
    }

    if (event.kind === "bullmq.job.completed") {
      void handleVideoChildCompleted(event);
      return;
    }

    if (event.kind === "bullmq.job.failed") {
      void handleVideoChildFailed(event);
      return;
    }

    if (event.kind === "bullmq.job.dlq") {
      void handleVideoChildDlq(event);
    }
  });
}

async function processUpload(uploadIndex: number): Promise<void> {
  const uploadId = `video-${uploadIndex}`;
  const intakeRequestId = `upload-${uploadIndex}`;
  const parentRequestId = `${intakeRequestId}:parent`;

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "postgres",
    data: {
      requestId: intakeRequestId,
      uploadId,
      requestKind: "video_upload",
    },
    latencyMs: 0,
    description: `Video upload received ${uploadId}`,
  });

  await runVideoPipelineUploadIntake(buildContext(intakeRequestId, 1), uploadId);

  const parentJobId = await enqueueVideoPipelineParentJob(
    buildContext(parentRequestId, 1),
    {
      uploadId,
      expectedChildCount: renditionProfiles.length,
    },
  );
  parentJobsCreated += 1;

  emitPhaseChange(2, "Phase 2 activated: parent-child transcode jobs");

  const progressKeys: Record<RenditionName, string> = {
    "240p": buildProgressKey(uploadId, "240p"),
    "360p": buildProgressKey(uploadId, "360p"),
    "720p": buildProgressKey(uploadId, "720p"),
    "1080p": buildProgressKey(uploadId, "1080p"),
    "4k": buildProgressKey(uploadId, "4k"),
  };

  uploadsById.set(uploadId, {
    uploadId,
    parentRequestId,
    parentJobId,
    progressKeys,
    completedRenditions: new Set<RenditionName>(),
    failedRenditions: new Set<RenditionName>(),
    dlqRenditions: new Set<RenditionName>(),
    routed: false,
    routeInFlight: false,
    finalized: false,
    finalizeInFlight: false,
  });

  for (const rendition of renditionProfiles) {
    const childRequestId = `${intakeRequestId}:child:${rendition}`;
    childRequestsById.set(childRequestId, {
      uploadId,
      rendition,
      progressKey: progressKeys[rendition],
    });

    await enqueueVideoPipelineChildJob(buildContext(childRequestId, 2), {
      uploadId,
      parentRequestId,
      parentJobId,
      rendition,
      shouldFail: rendition === forcedFailRendition,
      attempts: rendition === forcedFailRendition ? 3 : 1,
      backoffDelayMs: 180,
      progressTtlSeconds,
    });

    childJobsCreated += 1;
  }

  totalUploads += 1;
}

async function runIngestionTick(): Promise<void> {
  if (!running || ingestionBusy) {
    return;
  }

  ingestionBusy = true;

  try {
    if (forcedPhase !== null) {
      emitPhaseChange(forcedPhase, `Phase ${forcedPhase} activated by user jump`);
      forcedPhase = null;
    }

    if (totalUploads >= uploadTarget) {
      stopIngestionTimer();
      await maybeCompleteScenario();
      return;
    }

    await processUpload(totalUploads + 1);

    if (totalUploads >= uploadTarget) {
      stopIngestionTimer();
      await maybeCompleteScenario();
    }
  } finally {
    ingestionBusy = false;
  }
}

export async function startVideoPipelineScenario(): Promise<void> {
  if (running) {
    return;
  }

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }

  running = true;
  totalUploads = 0;
  parentJobsCreated = 0;
  childJobsCreated = 0;
  childJobsCompleted = 0;
  childJobsFailed = 0;
  dlqJobs = 0;
  routingMessages = 0;
  kafkaProduced = 0;
  finalizedUploads = 0;
  currentPhase = 0;
  ingestionBusy = false;
  forcedPhase = null;

  uploadsById.clear();
  childRequestsById.clear();

  registerEventHandlers();
  emitPhaseChange(1, "Phase 1 activated: upload intake and parent job setup");

  await runIngestionTick();

  ingestionTimer = setInterval(() => {
    void runIngestionTick();
  }, uploadIngestionIntervalMs);
}

export async function stopVideoPipelineScenario(): Promise<void> {
  running = false;
  ingestionBusy = false;
  forcedPhase = null;

  stopIngestionTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

export function isVideoPipelineScenarioRunning(): boolean {
  return running;
}

export function setVideoPipelineScenarioPhase(phase: number): void {
  if (phase < 1 || phase > 5) {
    return;
  }

  forcedPhase = phase;
}

export function setVideoPipelineUploadTarget(target: number): void {
  uploadTarget = Math.max(1, Math.trunc(target));
}

export function getVideoPipelineStatus(): VideoPipelineStatus {
  return {
    running,
    uploadTarget,
    totalUploads,
    parentJobsCreated,
    childJobsCreated,
    childJobsCompleted,
    childJobsFailed,
    dlqJobs,
    routingMessages,
    kafkaProduced,
    finalizedUploads,
    currentPhase,
  };
}

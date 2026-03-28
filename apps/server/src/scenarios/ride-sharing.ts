import { emitSimulationEvent, onSimulationEvent } from "../events/emitter";
import type { SimulationContext, SimulationEvent } from "../events/types";
import { enqueueRideDispatchJob } from "../services/bullmq";
import { produceKafkaEvent } from "../services/kafka";
import { runRideSharingTripCompletion } from "../services/postgres";
import { publishRideDispatchMessage } from "../services/rabbitmq";
import {
  geoAddDriverLocation,
  geoSearchNearbyDrivers,
  publishRedisMessage,
} from "../services/redis";

const scenarioName = "ride-sharing";
const kafkaTopic = "trip-events" as const;
const redisGeoKey = "ride-sharing:drivers:geo";
const redisHeartbeatChannel = "ride-sharing:driver-heartbeats";
const heartbeatTtlSeconds = 30;
const heartbeatIntervalMs = 2_000;
const dispatchIntervalMs = 1_200;
const defaultDriverCount = 36;
const defaultRideRequestTarget = 24;
const primaryRadiusKm = 3;
const fallbackRadiusKm = 8;
const dispatchTimeoutSeconds = 30;

type DriverPosition = {
  driverId: string;
  longitude: number;
  latitude: number;
};

type PassengerRequest = {
  passengerId: string;
  longitude: number;
  latitude: number;
};

type RideSharingStatus = {
  running: boolean;
  rideRequestTarget: number;
  totalRideRequests: number;
  matchedTrips: number;
  completedTrips: number;
  rejectedTrips: number;
  driverHeartbeats: number;
  currentPhase: number;
  auditProduced: number;
};

let running = false;
let currentPhase = 0;
let rideRequestTarget = defaultRideRequestTarget;
let totalRideRequests = 0;
let matchedTrips = 0;
let completedTrips = 0;
let rejectedTrips = 0;
let driverHeartbeats = 0;
let auditProduced = 0;
let heartbeatTick = 0;
let dispatchBusy = false;
let forcedPhase: number | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let dispatchTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeFromBus: (() => void) | null = null;

let drivers: DriverPosition[] = [];
const requestsById = new Map<string, PassengerRequest>();
const settledRequestIds = new Set<string>();

function buildContext(requestId: string, phase: number): SimulationContext {
  return {
    scenario: scenarioName,
    phase,
    requestId,
  };
}

function parseStringData(event: SimulationEvent, key: string): string | null {
  const value = event.data[key];
  return typeof value === "string" ? value : null;
}

function parseNumberData(event: SimulationEvent, key: string): number | null {
  const value = event.data[key];
  return typeof value === "number" ? value : null;
}

function buildDriverPositions(count: number): DriverPosition[] {
  const centerLongitude = -122.4194;
  const centerLatitude = 37.7749;
  const output: DriverPosition[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const radius = 0.016 + (index % 5) * 0.002;

    output.push({
      driverId: `driver-${index + 1}`,
      longitude: centerLongitude + Math.cos(angle) * radius,
      latitude: centerLatitude + Math.sin(angle) * radius,
    });
  }

  return output;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function advanceDriverPositions(tick: number): void {
  const centerLongitude = -122.4194;
  const centerLatitude = 37.7749;

  drivers = drivers.map((driver, index) => {
    const drift = (((tick + index) % 9) - 4) * 0.00035;

    return {
      ...driver,
      longitude: clamp(
        driver.longitude + drift,
        centerLongitude - 0.05,
        centerLongitude + 0.05,
      ),
      latitude: clamp(
        driver.latitude - drift / 2,
        centerLatitude - 0.05,
        centerLatitude + 0.05,
      ),
    };
  });
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
    target: "redis",
    data: {
      phase,
      title,
    },
    latencyMs: 0,
    description: title,
  });
}

function stopHeartbeatTimer(): void {
  if (!heartbeatTimer) {
    return;
  }

  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function stopDispatchTimer(): void {
  if (!dispatchTimer) {
    return;
  }

  clearInterval(dispatchTimer);
  dispatchTimer = null;
}

function toRoundedCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

async function processDriverHeartbeat(driver: DriverPosition): Promise<void> {
  const heartbeatRequestId = `heartbeat-${driver.driverId}-${heartbeatTick}`;
  const context = buildContext(heartbeatRequestId, 1);

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 1,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: {
      requestId: heartbeatRequestId,
      requestKind: "driver_heartbeat",
      driverId: driver.driverId,
    },
    latencyMs: 0,
    description: `Driver heartbeat received from ${driver.driverId}`,
  });

  await geoAddDriverLocation(
    redisGeoKey,
    driver.driverId,
    driver.longitude,
    driver.latitude,
    heartbeatTtlSeconds,
    context,
  );

  const payload = `${driver.driverId}:${toRoundedCoordinate(driver.longitude)}:${toRoundedCoordinate(driver.latitude)}`;
  await publishRedisMessage(redisHeartbeatChannel, payload, context);

  driverHeartbeats += 1;
}

async function runHeartbeatTick(): Promise<void> {
  if (!running) {
    return;
  }

  heartbeatTick += 1;

  if (forcedPhase !== null) {
    emitPhaseChange(forcedPhase, `Phase ${forcedPhase} activated by user jump`);
    forcedPhase = null;
  }

  advanceDriverPositions(heartbeatTick);

  const tasks: Array<Promise<void>> = [];
  for (const driver of drivers) {
    tasks.push(processDriverHeartbeat(driver));
  }

  await Promise.all(tasks);

  if (currentPhase < 2) {
    emitPhaseChange(2, "Phase 2 activated: ride dispatch queueing");
  }
}

function buildPassengerRequest(index: number): PassengerRequest {
  const centerLongitude = -122.4194;
  const centerLatitude = 37.7749;
  const shift = index * 0.35;

  return {
    passengerId: `passenger-${index}`,
    longitude: centerLongitude + Math.cos(shift) * 0.014,
    latitude: centerLatitude + Math.sin(shift) * 0.012,
  };
}

async function enqueueDispatchAttempt(
  requestId: string,
  request: PassengerRequest,
  attempt: 1 | 2,
): Promise<void> {
  const context = buildContext(requestId, 2);
  const searchRadiusKm = attempt === 1 ? primaryRadiusKm : fallbackRadiusKm;

  const nearbyDrivers = await geoSearchNearbyDrivers(
    redisGeoKey,
    request.longitude,
    request.latitude,
    searchRadiusKm,
    5,
    context,
  );

  const forceRetry =
    attempt === 1 && nearbyDrivers.length > 0 && totalRideRequests % 4 === 0;

  await enqueueRideDispatchJob(context, {
    passengerId: request.passengerId,
    candidateDriverIds: nearbyDrivers,
    attempt,
    searchRadiusKm,
    timeoutSeconds: dispatchTimeoutSeconds,
    forceRetry,
    retryDelayMs: attempt === 1 ? 0 : 450,
  });
}

async function processRideRequest(requestIndex: number): Promise<void> {
  const requestId = `ride-${requestIndex}`;
  const request = buildPassengerRequest(requestIndex);

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 2,
    kind: "request.received",
    source: "elysia",
    target: "redis",
    data: {
      requestId,
      requestKind: "ride_request",
      passengerId: request.passengerId,
    },
    latencyMs: 0,
    description: `Ride request received for ${request.passengerId}`,
  });

  requestsById.set(requestId, request);
  totalRideRequests += 1;
  await enqueueDispatchAttempt(requestId, request, 1);
}

async function runTripLifecycle(
  requestId: string,
  passengerId: string,
  driverId: string,
): Promise<void> {
  const lifecycleStates = [
    "requested",
    "matched",
    "driver_en_route",
    "pickup",
    "in_trip",
    "completed",
  ] as const;

  for (const state of lifecycleStates) {
    await produceKafkaEvent(
      buildContext(requestId, 4),
      `trip_state:${state}`,
      kafkaTopic,
    );
    auditProduced += 1;
    await Bun.sleep(40);
  }

  await runRideSharingTripCompletion(
    buildContext(requestId, 4),
    passengerId,
    driverId,
    "completed",
  );
}

async function maybeCompleteScenario(): Promise<void> {
  if (!running) {
    return;
  }

  if (totalRideRequests < rideRequestTarget) {
    return;
  }

  if (settledRequestIds.size < totalRideRequests) {
    return;
  }

  emitSimulationEvent({
    scenario: scenarioName,
    phase: 4,
    kind: "scenario.complete",
    source: "elysia",
    data: {
      rideRequestTarget,
      totalRideRequests,
      matchedTrips,
      completedTrips,
      rejectedTrips,
      driverHeartbeats,
      kafkaAuditEvents: auditProduced,
    },
    latencyMs: 0,
    description: "Ride-sharing scenario complete",
  });

  running = false;
  stopDispatchTimer();
  stopHeartbeatTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

async function handleDispatchCompleted(event: SimulationEvent): Promise<void> {
  const requestId = parseStringData(event, "requestId");
  const passengerId = parseStringData(event, "passengerId");
  const driverId = parseStringData(event, "selectedDriverId");

  if (
    !requestId ||
    !passengerId ||
    !driverId ||
    settledRequestIds.has(requestId)
  ) {
    return;
  }

  matchedTrips += 1;
  emitPhaseChange(3, "Phase 3 activated: competing consumers dispatch");

  await publishRideDispatchMessage(
    buildContext(requestId, 3),
    passengerId,
    driverId,
  );
}

async function handleDispatchFailed(event: SimulationEvent): Promise<void> {
  const requestId = parseStringData(event, "requestId");
  const attempt = parseNumberData(event, "attempt");

  if (!requestId || !attempt || settledRequestIds.has(requestId)) {
    return;
  }

  const request = requestsById.get(requestId);
  if (!request) {
    return;
  }

  if (attempt >= 2) {
    settledRequestIds.add(requestId);
    rejectedTrips += 1;

    emitSimulationEvent({
      scenario: scenarioName,
      phase: 2,
      kind: "request.rejected",
      source: "elysia",
      target: "bullmq",
      data: {
        requestId,
        passengerId: request.passengerId,
        reason: "dispatch_failed_after_retry",
      },
      latencyMs: 0,
      description: `Ride request ${requestId} rejected after retry`,
    });

    await maybeCompleteScenario();
    return;
  }

  await enqueueDispatchAttempt(requestId, request, 2);
}

async function handleDispatchAck(event: SimulationEvent): Promise<void> {
  const requestId = parseStringData(event, "requestId");
  const passengerId = parseStringData(event, "passengerId");
  const driverId = parseStringData(event, "driverId");

  if (
    !requestId ||
    !passengerId ||
    !driverId ||
    settledRequestIds.has(requestId)
  ) {
    return;
  }

  emitPhaseChange(4, "Phase 4 activated: trip lifecycle event stream");
  await runTripLifecycle(requestId, passengerId, driverId);

  settledRequestIds.add(requestId);
  completedTrips += 1;

  await maybeCompleteScenario();
}

function registerEventHandlers(): void {
  unsubscribeFromBus = onSimulationEvent((event) => {
    if (!running || event.scenario !== scenarioName) {
      return;
    }

    if (event.kind === "bullmq.job.completed") {
      void handleDispatchCompleted(event);
      return;
    }

    if (event.kind === "bullmq.job.failed") {
      void handleDispatchFailed(event);
      return;
    }

    if (event.kind === "rabbitmq.ack") {
      void handleDispatchAck(event);
    }
  });
}

async function runDispatchTick(): Promise<void> {
  if (!running || dispatchBusy) {
    return;
  }

  dispatchBusy = true;

  try {
    if (forcedPhase !== null) {
      emitPhaseChange(
        forcedPhase,
        `Phase ${forcedPhase} activated by user jump`,
      );
      forcedPhase = null;
    }

    if (totalRideRequests >= rideRequestTarget) {
      stopDispatchTimer();
      await maybeCompleteScenario();
      return;
    }

    await processRideRequest(totalRideRequests + 1);

    if (totalRideRequests >= rideRequestTarget) {
      stopDispatchTimer();
      await maybeCompleteScenario();
    }
  } finally {
    dispatchBusy = false;
  }
}

export async function startRideSharingScenario(): Promise<void> {
  if (running) {
    return;
  }

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }

  running = true;
  currentPhase = 0;
  totalRideRequests = 0;
  matchedTrips = 0;
  completedTrips = 0;
  rejectedTrips = 0;
  driverHeartbeats = 0;
  auditProduced = 0;
  heartbeatTick = 0;
  dispatchBusy = false;
  forcedPhase = null;

  requestsById.clear();
  settledRequestIds.clear();
  drivers = buildDriverPositions(defaultDriverCount);

  registerEventHandlers();
  emitPhaseChange(1, "Phase 1 activated: driver heartbeat stream");

  await runHeartbeatTick();
  await runDispatchTick();

  heartbeatTimer = setInterval(() => {
    void runHeartbeatTick();
  }, heartbeatIntervalMs);

  dispatchTimer = setInterval(() => {
    void runDispatchTick();
  }, dispatchIntervalMs);
}

export async function stopRideSharingScenario(): Promise<void> {
  running = false;
  dispatchBusy = false;
  forcedPhase = null;

  stopDispatchTimer();
  stopHeartbeatTimer();

  if (unsubscribeFromBus) {
    unsubscribeFromBus();
    unsubscribeFromBus = null;
  }
}

export function isRideSharingScenarioRunning(): boolean {
  return running;
}

export function setRideSharingScenarioPhase(phase: number): void {
  if (phase < 1 || phase > 4) {
    return;
  }

  forcedPhase = phase;
}

export function setRideSharingRequestTarget(target: number): void {
  rideRequestTarget = Math.max(4, Math.trunc(target));
}

export function getRideSharingStatus(): RideSharingStatus {
  return {
    running,
    rideRequestTarget,
    totalRideRequests,
    matchedTrips,
    completedTrips,
    rejectedTrips,
    driverHeartbeats,
    currentPhase,
    auditProduced,
  };
}

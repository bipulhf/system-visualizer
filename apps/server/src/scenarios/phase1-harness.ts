import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { enqueueBullMqJob } from "../services/bullmq";
import { produceKafkaEvent } from "../services/kafka";
import { runPostgresTransaction } from "../services/postgres";
import { publishRabbitMqMessage } from "../services/rabbitmq";
import { decrementRedisKey, setRedisValue } from "../services/redis";

const scenarioName = "phase1-harness";

let running = false;
let loopHandle: ReturnType<typeof setInterval> | null = null;
let currentSequence = 0;
let currentPhase = 0;
let busy = false;

function getContext(sequence: number): SimulationContext {
  return {
    scenario: scenarioName,
    phase: ((sequence - 1) % 4) + 1,
    requestId: `req-${sequence}`,
  };
}

async function runLoopTick(): Promise<void> {
  if (!running || busy) {
    return;
  }

  busy = true;

  try {
    currentSequence += 1;
    const context = getContext(currentSequence);

    if (context.phase !== currentPhase) {
      currentPhase = context.phase;
      emitSimulationEvent({
        scenario: context.scenario,
        phase: context.phase,
        kind: "phase.change",
        source: "elysia",
        target: "redis",
        data: {
          phase: context.phase,
        },
        latencyMs: 0,
        description: `Phase ${context.phase} activated`,
      });
    }

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "request.received",
      source: "elysia",
      target: "redis",
      data: {
        requestId: context.requestId,
      },
      latencyMs: 0,
      description: `API accepted ${context.requestId}`,
    });

    if (currentSequence % 6 === 0) {
      emitSimulationEvent({
        scenario: context.scenario,
        phase: context.phase,
        kind: "request.rejected",
        source: "elysia",
        target: "redis",
        data: {
          requestId: context.requestId,
          reason: "rate_limit",
        },
        latencyMs: 1,
        description: `API rejected ${context.requestId} due to rate limiting`,
      });

      return;
    }

    const stockAfterDecrement = await decrementRedisKey(
      "stock:item_42",
      context,
    );
    const shouldFail = currentSequence % 7 === 0;

    await enqueueBullMqJob(context, shouldFail);
    await publishRabbitMqMessage(context, `order:${context.requestId}`);
    await produceKafkaEvent(context, `stock_after_decr:${stockAfterDecrement}`);
    await runPostgresTransaction(context);

    if (currentSequence % 20 === 0) {
      emitSimulationEvent({
        scenario: context.scenario,
        phase: context.phase,
        kind: "scenario.complete",
        source: "elysia",
        data: {
          processedRequests: currentSequence,
        },
        latencyMs: 0,
        description: "Phase 1 harness completed one full learning cycle",
      });
    }
  } finally {
    busy = false;
  }
}

export async function startPhaseOneHarness(): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  currentSequence = 0;
  currentPhase = 0;

  await setRedisValue("stock:item_42", "100", {
    scenario: scenarioName,
    phase: 1,
    requestId: "bootstrap",
  });

  await runLoopTick();
  loopHandle = setInterval(() => {
    void runLoopTick();
  }, 1200);
}

export async function stopPhaseOneHarness(): Promise<void> {
  running = false;

  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
}

export function isPhaseOneHarnessRunning(): boolean {
  return running;
}

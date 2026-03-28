import postgres from "postgres";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const sql = postgres(env.postgresUrl, { max: 1 });

export async function checkPostgresConnection(): Promise<void> {
  await sql`select 1`;
}

export async function runPostgresTransaction(
  context: SimulationContext,
): Promise<void> {
  const transactionStartedAt = performance.now();

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.tx.begin",
    source: "postgres",
    data: {
      requestId: context.requestId,
    },
    latencyMs: 0,
    description: `Postgres transaction begin ${context.requestId}`,
  });

  await sql`begin`;

  try {
    const queryStartedAt = performance.now();
    await sql`select ${context.requestId}::text as request_id`;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        query: "select_request_id",
      },
      latencyMs: Math.round(performance.now() - queryStartedAt),
      description: `Postgres query for ${context.requestId}`,
    });

    await sql`commit`;
  } catch (error) {
    await sql`rollback`;
    throw error;
  }

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.tx.commit",
    source: "postgres",
    data: {
      requestId: context.requestId,
    },
    latencyMs: Math.round(performance.now() - transactionStartedAt),
    description: `Postgres transaction commit ${context.requestId}`,
  });
}

export async function closePostgresConnection(): Promise<void> {
  await sql.end({ timeout: 2 });
}

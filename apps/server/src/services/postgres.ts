import postgres from "postgres";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const sql = postgres(env.postgresUrl, { max: 1 });
let flashSaleTableEnsured = false;

async function ensureFlashSaleTable(): Promise<void> {
  if (flashSaleTableEnsured) {
    return;
  }

  await sql`
    create table if not exists flash_sale_orders (
      request_id text primary key,
      scenario text not null,
      order_status text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  flashSaleTableEnsured = true;
}

export async function checkPostgresConnection(): Promise<void> {
  await sql`select 1`;
  await ensureFlashSaleTable();
}

export async function runPostgresTransaction(
  context: SimulationContext,
  orderStatus: "confirmed" | "failed" = "confirmed",
): Promise<void> {
  const transactionStartedAt = performance.now();
  await ensureFlashSaleTable();

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
    await sql`
      insert into flash_sale_orders (request_id, scenario, order_status)
      values (${context.requestId}, ${context.scenario}, ${orderStatus})
      on conflict (request_id)
      do update set
        order_status = excluded.order_status,
        updated_at = now()
    `;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        query: "upsert_flash_sale_order",
        orderStatus,
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

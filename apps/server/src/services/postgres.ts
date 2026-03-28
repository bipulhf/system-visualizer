import postgres from "postgres";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const sql = postgres(env.postgresUrl, { max: 1 });
let flashSaleTableEnsured = false;
let rideSharingTableEnsured = false;
let videoPipelineTableEnsured = false;

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

async function ensureRideSharingTable(): Promise<void> {
  if (rideSharingTableEnsured) {
    return;
  }

  await sql`
    create table if not exists ride_sharing_trips (
      request_id text primary key,
      scenario text not null,
      passenger_id text not null,
      driver_id text not null,
      trip_status text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  rideSharingTableEnsured = true;
}

async function ensureVideoPipelineTable(): Promise<void> {
  if (videoPipelineTableEnsured) {
    return;
  }

  await sql`
    create table if not exists video_pipeline_assets (
      upload_id text primary key,
      scenario text not null,
      ingest_status text not null,
      renditions_completed integer not null default 0,
      renditions_failed integer not null default 0,
      published boolean not null default false,
      failure_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  videoPipelineTableEnsured = true;
}

export async function checkPostgresConnection(): Promise<void> {
  await sql`select 1`;
  await ensureFlashSaleTable();
  await ensureRideSharingTable();
  await ensureVideoPipelineTable();
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

export async function runRideSharingTripCompletion(
  context: SimulationContext,
  passengerId: string,
  driverId: string,
  tripStatus: "completed" | "cancelled" = "completed",
): Promise<void> {
  const transactionStartedAt = performance.now();
  await ensureRideSharingTable();

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
      insert into ride_sharing_trips (
        request_id,
        scenario,
        passenger_id,
        driver_id,
        trip_status
      )
      values (
        ${context.requestId},
        ${context.scenario},
        ${passengerId},
        ${driverId},
        ${tripStatus}
      )
      on conflict (request_id)
      do update set
        driver_id = excluded.driver_id,
        trip_status = excluded.trip_status,
        updated_at = now()
    `;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        query: "upsert_ride_sharing_trip",
        passengerId,
        driverId,
        tripStatus,
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

export async function runVideoPipelineUploadIntake(
  context: SimulationContext,
  uploadId: string,
): Promise<void> {
  const transactionStartedAt = performance.now();
  await ensureVideoPipelineTable();

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.tx.begin",
    source: "postgres",
    data: {
      requestId: context.requestId,
      uploadId,
    },
    latencyMs: 0,
    description: `Postgres transaction begin ${context.requestId}`,
  });

  await sql`begin`;

  try {
    const queryStartedAt = performance.now();
    await sql`
      insert into video_pipeline_assets (
        upload_id,
        scenario,
        ingest_status,
        renditions_completed,
        renditions_failed,
        published,
        failure_reason
      )
      values (
        ${uploadId},
        ${context.scenario},
        ${"ingesting"},
        ${0},
        ${0},
        ${false},
        ${null}
      )
      on conflict (upload_id)
      do update set
        ingest_status = excluded.ingest_status,
        renditions_completed = excluded.renditions_completed,
        renditions_failed = excluded.renditions_failed,
        published = excluded.published,
        failure_reason = excluded.failure_reason,
        updated_at = now()
    `;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        uploadId,
        query: "upsert_video_pipeline_upload_intake",
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
      uploadId,
    },
    latencyMs: Math.round(performance.now() - transactionStartedAt),
    description: `Postgres transaction commit ${context.requestId}`,
  });
}

export async function runVideoPipelineFinalize(
  context: SimulationContext,
  options: {
    uploadId: string;
    renditionsCompleted: number;
    renditionsFailed: number;
    published: boolean;
    failureReason: string | null;
  },
): Promise<void> {
  const transactionStartedAt = performance.now();
  await ensureVideoPipelineTable();

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.tx.begin",
    source: "postgres",
    data: {
      requestId: context.requestId,
      uploadId: options.uploadId,
    },
    latencyMs: 0,
    description: `Postgres transaction begin ${context.requestId}`,
  });

  await sql`begin`;

  try {
    const queryStartedAt = performance.now();
    await sql`
      update video_pipeline_assets
      set
        ingest_status = ${"finalized"},
        renditions_completed = ${options.renditionsCompleted},
        renditions_failed = ${options.renditionsFailed},
        published = ${options.published},
        failure_reason = ${options.failureReason},
        updated_at = now()
      where upload_id = ${options.uploadId}
    `;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        uploadId: options.uploadId,
        query: "update_video_pipeline_finalize",
        renditionsCompleted: options.renditionsCompleted,
        renditionsFailed: options.renditionsFailed,
        published: options.published,
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
      uploadId: options.uploadId,
    },
    latencyMs: Math.round(performance.now() - transactionStartedAt),
    description: `Postgres transaction commit ${context.requestId}`,
  });
}

export async function closePostgresConnection(): Promise<void> {
  await sql.end({ timeout: 2 });
}

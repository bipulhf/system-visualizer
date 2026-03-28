import postgres from "postgres";
import { emitSimulationEvent } from "../events/emitter";
import type { SimulationContext } from "../events/types";
import { env } from "./env";

const sql = postgres(env.postgresUrl, { max: 1 });
let flashSaleTableEnsured = false;
let rideSharingTableEnsured = false;
let videoPipelineTableEnsured = false;
let bankingTablesEnsured = false;

type BankingAccountSeed = {
  accountId: string;
  balanceCents: number;
};

type BankingTransferResult = {
  status: "committed" | "insufficient_funds";
  fromBalanceCents: number;
  toBalanceCents: number;
};

type BankingAuditReadResult = {
  transferId: string;
  ledgerStatus: string | null;
  amountCents: number | null;
  found: boolean;
};

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

async function ensureBankingTables(): Promise<void> {
  if (bankingTablesEnsured) {
    return;
  }

  await sql`
    create table if not exists banking_accounts (
      account_id text primary key,
      balance_cents bigint not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists banking_ledger (
      transfer_id text primary key,
      scenario text not null,
      from_account_id text not null,
      to_account_id text not null,
      amount_cents bigint not null,
      ledger_status text not null,
      fraud_decision text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  bankingTablesEnsured = true;
}

export async function checkPostgresConnection(): Promise<void> {
  await sql`select 1`;
  await ensureFlashSaleTable();
  await ensureRideSharingTable();
  await ensureVideoPipelineTable();
  await ensureBankingTables();
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

export async function seedBankingAccounts(
  context: SimulationContext,
  accounts: BankingAccountSeed[],
): Promise<void> {
  const transactionStartedAt = performance.now();
  await ensureBankingTables();

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.tx.begin",
    source: "postgres",
    data: {
      requestId: context.requestId,
      accountCount: accounts.length,
    },
    latencyMs: 0,
    description: `Postgres transaction begin ${context.requestId}`,
  });

  await sql`begin`;

  try {
    const queryStartedAt = performance.now();
    await sql`delete from banking_ledger where scenario = ${context.scenario}`;

    for (const account of accounts) {
      await sql`
        insert into banking_accounts (account_id, balance_cents)
        values (${account.accountId}, ${account.balanceCents})
        on conflict (account_id)
        do update set
          balance_cents = excluded.balance_cents,
          updated_at = now()
      `;
    }

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        query: "seed_banking_accounts",
        accountCount: accounts.length,
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
      accountCount: accounts.length,
    },
    latencyMs: Math.round(performance.now() - transactionStartedAt),
    description: `Postgres transaction commit ${context.requestId}`,
  });
}

export async function runBankingSerializableTransfer(
  context: SimulationContext,
  options: {
    transferId: string;
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
  },
): Promise<BankingTransferResult> {
  const transactionStartedAt = performance.now();
  await ensureBankingTables();

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.tx.begin",
    source: "postgres",
    data: {
      requestId: context.requestId,
      transferId: options.transferId,
      isolationLevel: "serializable",
    },
    latencyMs: 0,
    description: `Postgres transaction begin ${context.requestId}`,
  });

  await sql`begin isolation level serializable`;

  try {
    const accountQueryStartedAt = performance.now();
    const accountRows = await sql<
      { account_id: string; balance_cents: number }[]
    >`
      select account_id, balance_cents
      from banking_accounts
      where
        account_id = ${options.fromAccountId}
        or account_id = ${options.toAccountId}
      for update
    `;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        transferId: options.transferId,
        query: "select_banking_accounts_for_update",
      },
      latencyMs: Math.round(performance.now() - accountQueryStartedAt),
      description: `Postgres query for ${context.requestId}`,
    });

    const balancesByAccount = new Map<string, number>();
    for (const row of accountRows) {
      balancesByAccount.set(row.account_id, row.balance_cents);
    }

    const fromBalance = balancesByAccount.get(options.fromAccountId) ?? 0;
    const toBalance = balancesByAccount.get(options.toAccountId) ?? 0;

    if (fromBalance < options.amountCents) {
      const insufficientQueryStartedAt = performance.now();
      await sql`
        insert into banking_ledger (
          transfer_id,
          scenario,
          from_account_id,
          to_account_id,
          amount_cents,
          ledger_status,
          fraud_decision
        )
        values (
          ${options.transferId},
          ${context.scenario},
          ${options.fromAccountId},
          ${options.toAccountId},
          ${options.amountCents},
          ${"insufficient_funds"},
          ${null}
        )
        on conflict (transfer_id)
        do update set
          ledger_status = excluded.ledger_status,
          fraud_decision = excluded.fraud_decision,
          updated_at = now()
      `;

      emitSimulationEvent({
        scenario: context.scenario,
        phase: context.phase,
        kind: "postgres.query",
        source: "postgres",
        data: {
          requestId: context.requestId,
          transferId: options.transferId,
          query: "upsert_banking_ledger_insufficient_funds",
        },
        latencyMs: Math.round(performance.now() - insufficientQueryStartedAt),
        description: `Postgres query for ${context.requestId}`,
      });

      await sql`commit`;

      emitSimulationEvent({
        scenario: context.scenario,
        phase: context.phase,
        kind: "postgres.tx.commit",
        source: "postgres",
        data: {
          requestId: context.requestId,
          transferId: options.transferId,
          status: "insufficient_funds",
        },
        latencyMs: Math.round(performance.now() - transactionStartedAt),
        description: `Postgres transaction commit ${context.requestId}`,
      });

      return {
        status: "insufficient_funds",
        fromBalanceCents: fromBalance,
        toBalanceCents: toBalance,
      };
    }

    const debitQueryStartedAt = performance.now();
    await sql`
      update banking_accounts
      set
        balance_cents = balance_cents - ${options.amountCents},
        updated_at = now()
      where account_id = ${options.fromAccountId}
    `;

    await sql`
      update banking_accounts
      set
        balance_cents = balance_cents + ${options.amountCents},
        updated_at = now()
      where account_id = ${options.toAccountId}
    `;

    await sql`
      insert into banking_ledger (
        transfer_id,
        scenario,
        from_account_id,
        to_account_id,
        amount_cents,
        ledger_status,
        fraud_decision
      )
      values (
        ${options.transferId},
        ${context.scenario},
        ${options.fromAccountId},
        ${options.toAccountId},
        ${options.amountCents},
        ${"posted"},
        ${null}
      )
      on conflict (transfer_id)
      do update set
        ledger_status = excluded.ledger_status,
        updated_at = now()
    `;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.query",
      source: "postgres",
      data: {
        requestId: context.requestId,
        transferId: options.transferId,
        query: "apply_banking_transfer_and_ledger_insert",
        amountCents: options.amountCents,
      },
      latencyMs: Math.round(performance.now() - debitQueryStartedAt),
      description: `Postgres query for ${context.requestId}`,
    });

    await sql`commit`;

    const committedFromBalance = fromBalance - options.amountCents;
    const committedToBalance = toBalance + options.amountCents;

    emitSimulationEvent({
      scenario: context.scenario,
      phase: context.phase,
      kind: "postgres.tx.commit",
      source: "postgres",
      data: {
        requestId: context.requestId,
        transferId: options.transferId,
        status: "committed",
      },
      latencyMs: Math.round(performance.now() - transactionStartedAt),
      description: `Postgres transaction commit ${context.requestId}`,
    });

    return {
      status: "committed",
      fromBalanceCents: committedFromBalance,
      toBalanceCents: committedToBalance,
    };
  } catch (error) {
    await sql`rollback`;
    throw error;
  }
}

export async function updateBankingLedgerStatus(
  context: SimulationContext,
  options: {
    transferId: string;
    ledgerStatus: string;
    fraudDecision: string | null;
  },
): Promise<void> {
  const queryStartedAt = performance.now();
  await ensureBankingTables();

  await sql`
    update banking_ledger
    set
      ledger_status = ${options.ledgerStatus},
      fraud_decision = ${options.fraudDecision},
      updated_at = now()
    where transfer_id = ${options.transferId}
  `;

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.query",
    source: "postgres",
    data: {
      requestId: context.requestId,
      transferId: options.transferId,
      query: "update_banking_ledger_status",
      ledgerStatus: options.ledgerStatus,
      fraudDecision: options.fraudDecision,
    },
    latencyMs: Math.round(performance.now() - queryStartedAt),
    description: `Postgres query for ${context.requestId}`,
  });
}

export async function runBankingAuditRead(
  context: SimulationContext,
  transferId: string,
): Promise<BankingAuditReadResult> {
  const queryStartedAt = performance.now();
  await ensureBankingTables();

  const rows = await sql<
    { transfer_id: string; ledger_status: string; amount_cents: number }[]
  >`
    select transfer_id, ledger_status, amount_cents
    from banking_ledger
    where transfer_id = ${transferId}
    limit 1
  `;

  const row = rows[0];

  emitSimulationEvent({
    scenario: context.scenario,
    phase: context.phase,
    kind: "postgres.query",
    source: "postgres",
    data: {
      requestId: context.requestId,
      transferId,
      query: "read_banking_audit_ledger",
      found: Boolean(row),
      ledgerStatus: row?.ledger_status ?? null,
    },
    latencyMs: Math.round(performance.now() - queryStartedAt),
    description: `Postgres query for ${context.requestId}`,
  });

  return {
    transferId,
    ledgerStatus: row?.ledger_status ?? null,
    amountCents: row?.amount_cents ?? null,
    found: Boolean(row),
  };
}

export async function closePostgresConnection(): Promise<void> {
  await sql.end({ timeout: 2 });
}

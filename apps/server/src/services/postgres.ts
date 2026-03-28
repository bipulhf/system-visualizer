import postgres from "postgres";
import { env } from "./env";

const sql = postgres(env.postgresUrl, { max: 1 });

export async function checkPostgresConnection(): Promise<void> {
  await sql`select 1`;
}

export async function closePostgresConnection(): Promise<void> {
  await sql.end({ timeout: 2 });
}

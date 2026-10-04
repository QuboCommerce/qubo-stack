import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the monorepo root.",
  );
}

// One pool per process: dev HMR and Next workers re-evaluate this module, and
// each fresh pool would keep its connections until Postgres runs out of slots.
const g = globalThis as unknown as { __quboSql?: ReturnType<typeof postgres> };
const sql = (g.__quboSql ??= postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idle_timeout: 30,
}));

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { sql };

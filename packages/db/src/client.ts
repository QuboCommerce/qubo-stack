import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the monorepo root.",
  );
}

const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });

export type Database = typeof db;

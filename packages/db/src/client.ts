import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

const connectionString = process.env.DATABASE_URL!;

const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });

export type Database = typeof db;

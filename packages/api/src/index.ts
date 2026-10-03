import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { sql } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { auth } from "./lib/auth";
import { catalog } from "./routes/catalog";
import { commerce } from "./routes/commerce";
import { seo } from "./routes/seo";
import { sites } from "./routes/sites";
import { studioPublic, studioRoutes } from "./routes/studio";

const allowedOrigins = (process.env.QUBO_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const app = new Elysia()
  .use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : true,
      credentials: true,
    }),
  )
  .onError(({ code, error, status }) => {
    if (code === "NOT_FOUND") return status(404, { error: "not_found" });
    if (code === "VALIDATION" || code === "PARSE") return status(400, { error: "invalid_request" });
    console.error("[qubo-api]", error);
    return status(500, { error: "internal_error" });
  })
  .get("/health", async () => {
    const started = Date.now();
    await db.execute(sql`select 1`);
    return { ok: true, database: "up", latencyMs: Date.now() - started };
  })
  // Better Auth owns every /api/auth/* route across the platform.
  .mount("/api/auth", auth.handler)
  .use(sites)
  .use(catalog)
  .use(commerce)
  .use(studioRoutes)
  .use(studioPublic)
  .use(seo);

export type App = typeof app;

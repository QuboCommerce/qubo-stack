import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { sql } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { auth } from "./lib/auth";
import { catalog } from "./routes/catalog";
import { commerce, webhooks } from "./routes/commerce";
import { inbound } from "./routes/inbound";
import { account } from "./routes/account";
import { seo } from "./routes/seo";
import { forms } from "./routes/forms";
import { chat } from "./routes/chat";
import { sites } from "./routes/sites";
import { edge } from "./routes/edge";
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
  // Better Auth owns every /api/auth/* route. Not `.mount()`: that strips the prefix Better Auth
  // matches on, and Elysia must not parse the body before Better Auth reads it.
  .all("/api/auth/*", ({ request }) => auth.handler(request), { parse: "none" })
  .use(webhooks)
  .use(inbound)
  // Versioned public API; the storefront client pins it (API_VERSION in @qubo/storefront).
  .group("/v1", (v1) => v1.use(sites).use(catalog).use(commerce).use(account).use(studioRoutes).use(studioPublic).use(seo).use(forms).use(chat).use(edge));

export type App = typeof app;

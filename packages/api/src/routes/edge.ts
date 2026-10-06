import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { traefikConfig } from "@qubo/domains/server";

const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Polled by the edge (Traefik HTTP provider, see docs/VPS.md): routers and
 * certificates for every verified domain. Hostnames are public anyway; set
 * `QUBO_EDGE_TOKEN` to keep the list from being enumerated (`?token=`).
 */
export const edge = new Elysia({ prefix: "/edge" }).get("/traefik", async ({ query, status, set }) => {
  const expected = process.env.QUBO_EDGE_TOKEN?.trim();
  if (expected && !sameToken(String(query.token ?? ""), expected)) return status(401, { error: "unauthorized" });
  set.headers["cache-control"] = "no-store";
  return traefikConfig();
});

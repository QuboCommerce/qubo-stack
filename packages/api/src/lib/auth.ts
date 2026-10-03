import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@qubo/db/client";
import * as schema from "@qubo/db/schema";
import { allowedSiteOrigin } from "./origins";
import { resolveSite } from "./tenancy";

const staticOrigins = (process.env.QUBO_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Single Better Auth instance for the whole platform.
 *
 * Storefronts proxy their `/api/auth/*` here (see qubo-storefront), forwarding
 * `x-qubo-site` and `x-forwarded-host/proto`, so session cookies stay host-only
 * on the site's own domain and the request origin is trusted only when it
 * serves that site (accounts capability required).
 *
 * The Next apps currently construct their own instance against the same
 * tables. As storefronts migrate onto this API, they should stop doing that
 * and call here instead, so session handling lives in exactly one place.
 */
export const auth = betterAuth({
  trustedOrigins: async (request) => {
    const origin = request?.headers.get("origin");
    if (!request || !origin || staticOrigins.includes(origin)) return staticOrigins;
    const site = await resolveSite(request.headers).catch(() => null);
    if (!site?.capabilities.includes("accounts")) return staticOrigins;
    const allowed = await allowedSiteOrigin(site, origin);
    return allowed ? [...staticOrigins, allowed] : staticOrigins;
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    // Base URL (cookie Secure flag, callback checks) from the storefront proxy's forwarded host/proto.
    trustedProxyHeaders: true,
  },
});

export type Session = typeof auth.$Infer.Session;

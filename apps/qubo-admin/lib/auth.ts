import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@qubo/db/client";
import * as schema from "@qubo/db/schema";
import { siteHostFromAdminHost } from "@qubo/shared/admin-url";
import { isVerifiedSiteHost } from "@/lib/admin-host";
import { recordDevice } from "@/lib/sessions";

/** Own prefix so the panel cookie never collides with storefront customer sessions. */
export const ADMIN_COOKIE_PREFIX = "qubo-admin";

const staticOrigins = [
  "http://localhost:4000",
  "http://127.0.0.1:4000",
  process.env.BETTER_AUTH_URL,
  ...(process.env.QUBO_TRUSTED_ORIGINS ?? "").split(",").map((origin) => origin.trim()),
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  // Static list + `https://qubo.<verified site domain>` for the requesting origin only.
  trustedOrigins: async (request) => {
    const origin = request?.headers.get("origin");
    if (!origin || staticOrigins.includes(origin)) return staticOrigins;
    try {
      const url = new URL(origin);
      const siteHost = url.protocol === "https:" ? siteHostFromAdminHost(url.host) : null;
      if (siteHost && (await isVerifiedSiteHost(siteHost))) return [...staticOrigins, origin];
    } catch {}
    return staticOrigins;
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
  // No cookie cache: a revoked session (takeover, Security → Sessions) must stop working on the next request.
  session: { cookieCache: { enabled: false } },
  databaseHooks: {
    session: { create: { after: async (s) => { await recordDevice(s); } } },
  },
  // Host-only (no crossSubDomainCookies): the session never reaches other subdomains.
  advanced: { cookiePrefix: ADMIN_COOKIE_PREFIX, trustedProxyHeaders: true },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

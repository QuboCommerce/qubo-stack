import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@peltier/db/client";
import * as schema from "@peltier/db/schema";

/**
 * Single Better Auth instance for the whole platform.
 *
 * The Next apps currently construct their own instance against the same
 * tables. As storefronts migrate onto this API, they should stop doing that
 * and call here instead, so session handling lives in exactly one place.
 */
export const auth = betterAuth({
  trustedOrigins: (process.env.PELTIER_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
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
});

export type Session = typeof auth.$Infer.Session;

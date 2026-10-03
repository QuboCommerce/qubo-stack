import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@qubo/db/client";
import * as schema from "@qubo/db/schema";

export const auth = betterAuth({
  trustedOrigins: [
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://94.104.198.159:4000",
    process.env.BETTER_AUTH_URL,
  ].filter((origin): origin is string => Boolean(origin)),
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
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization, site } from "./site";

/**
 * Bring-your-own-key AI, per organisation (the billing and legal unit). The key
 * is AES-GCM encrypted with a secret from the instance env and never leaves the
 * server; the admin only ever sees its last four characters.
 */
export const aiSettings = pgTable("ai_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  /** `@qubo/ai` PROVIDERS id. */
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  /** Only for OpenAI-compatible endpoints (self-hosted models, gateways). */
  baseUrl: text("base_url"),
  apiKeyEnc: text("api_key_enc"),
  apiKeyHint: text("api_key_hint"),
  triage: boolean("triage").notNull().default(true),
  drafts: boolean("drafts").notNull().default(true),
  /** Input + output tokens per calendar month (UTC); null = no cap. */
  monthlyTokens: integer("monthly_tokens").default(2_000_000),
  updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One row per model call, for budgets and the usage meter. Prompts and answers are not stored. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => site.id, { onDelete: "set null" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    ok: boolean("ok").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_usage_org_created_idx").on(t.organizationId, t.createdAt)],
);

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * This instance's link to a Qubo Portal. One row at most: an instance belongs to
 * one portal organisation. Absent row = unlinked, which is a fully working
 * instance on Free limits (@qubo/protocol FREE_LIMITS).
 */
export const portalLink = pgTable("portal_link", {
  id: uuid("id").primaryKey().defaultRandom(),
  portalUrl: text("portal_url").notNull(),
  instanceId: text("instance_id").notNull(),
  /** Portal organisation (billing unit), not a local organisation. */
  portalOrganizationId: text("portal_organization_id").notNull(),
  jwksUrl: text("jwks_url").notNull(),
  /** Ed25519 keypair as JWK; the private key never leaves this database. */
  publicKeyJwk: jsonb("public_key_jwk").notNull(),
  privateKeyJwk: jsonb("private_key_jwk").notNull(),
  licenseToken: text("license_token"),
  licenseClaims: jsonb("license_claims"),
  licenseFetchedAt: timestamp("license_fetched_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

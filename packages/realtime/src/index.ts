/**
 * Typed event catalogue. Safe to import anywhere (no I/O).
 * Scope fields decide who receives an event: `siteId` → members of that site's org,
 * `orgId` → members of the org, `userId` → that user only. At least one is required.
 */
import { z } from "zod";

export const CHANNEL = "qubo_events";
/** Events older than this are pruned; a client further behind reloads instead of replaying. */
export const RETENTION_DAYS = 7;

const Actor = z.object({ id: z.string(), name: z.string() });
const Scope = z.object({ siteId: z.string().optional(), orgId: z.string().optional(), userId: z.string().optional() });

/** One browser tab's location. Kept in memory only (see `createPresence`), never stored. */
export const PresenceEntry = z.object({
  clientId: z.string(),
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  siteId: z.string(),
  route: z.string(),
  documentId: z.string().optional(),
  blockId: z.string().optional(),
  fieldPath: z.string().optional(),
  focused: z.boolean(),
  /** Server time (ms) of the last heartbeat. */
  at: z.number(),
});
export type PresenceEntry = z.infer<typeof PresenceEntry>;

const def = <T extends string, P extends z.ZodType>(type: T, payload: P) => Scope.extend({ type: z.literal(type), payload });

export const PlatformEvent = z.discriminatedUnion("type", [
  def("entity.updated", z.object({ table: z.string(), id: z.string(), action: z.enum(["created", "updated", "deleted"]), by: Actor })),
  def("document.published", z.object({ documentId: z.string(), version: z.number().int(), by: Actor })),
  def("document.patched", z.object({ documentId: z.string(), version: z.number().int(), by: Actor })),
  def("document.lease.acquired", z.object({ documentId: z.string(), by: Actor })),
  def("document.lease.released", z.object({ documentId: z.string(), by: Actor })),
  def("theme.published", z.object({ themeId: z.string(), by: Actor })),
  // Full snapshot of a site's presence; ephemeral (no id, not replayed).
  def("presence.changed", z.object({ entries: z.array(PresenceEntry) })),
  def("session.revoked", z.object({ sessionId: z.string(), by: z.object({ city: z.string().nullable(), deviceLabel: z.string().nullable() }) })),
  def("conversation.created", z.object({ conversationId: z.string() })),
  def("conversation.message", z.object({ conversationId: z.string(), messageId: z.string() })),
  def("site.domain.changed", z.object({ hostname: z.string() })),
  def("license.changed", z.object({ plan: z.string() })),
  def("release.available", z.object({ version: z.string() })),
]);
export type PlatformEvent = z.infer<typeof PlatformEvent>;
export type EventType = PlatformEvent["type"];
export const EVENT_TYPES = PlatformEvent.options.map((o) => o.shape.type.value) as EventType[];
export type EventOf<T extends EventType> = Extract<PlatformEvent, { type: T }>;

/** Types broadcast live only: never stored, no id, not replayed on resume or poll. */
export const EPHEMERAL_TYPES: ReadonlySet<EventType> = new Set<EventType>(["presence.changed"]);

/** An event as delivered: catalogue shape plus its durable id (`""` when ephemeral) and server timestamp. */
export type DeliveredEvent = PlatformEvent & { id: string; createdAt: string };

/** Who is listening: the sites/orgs they can see and their user id. */
export interface Audience {
  userId: string;
  siteIds: ReadonlySet<string>;
  orgIds: ReadonlySet<string>;
}

export function visibleTo(e: Pick<PlatformEvent, "siteId" | "orgId" | "userId">, a: Audience) {
  if (e.userId) return e.userId === a.userId;
  if (e.siteId) return a.siteIds.has(e.siteId);
  if (e.orgId) return a.orgIds.has(e.orgId);
  return false;
}

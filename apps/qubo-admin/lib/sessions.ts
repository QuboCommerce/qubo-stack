import "server-only";
import { createHash } from "node:crypto";
import { db } from "@qubo/db/client";
import { session, sessionDevice } from "@qubo/db/schema";
import { lookup, parseUserAgent, placeLabel } from "@qubo/geo";
import { and, desc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import { emit } from "@/lib/events";

/** Another session counts as "open" if it was used this recently. */
export const TAKEOVER_WINDOW_MIN = 30;

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Better Auth `session.create.after`: label the device and geolocate the IP (locally). */
export async function recordDevice(s: { id: string; userId: string; token: string; ipAddress?: string | null; userAgent?: string | null }) {
  try {
    const device = parseUserAgent(s.userAgent);
    const geo = lookup(s.ipAddress);
    await db
      .insert(sessionDevice)
      .values({
        sessionId: s.id,
        userId: s.userId,
        tokenHash: tokenHash(s.token),
        deviceLabel: device.label,
        browser: device.browser,
        os: device.os,
        ip: s.ipAddress ?? null,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        countryCode: geo.countryCode,
        lat: geo.lat,
        lng: geo.lng,
        isLocal: !!geo.local,
      })
      .onConflictDoNothing();
    // Housekeeping: forget devices that ended (or vanished) over 30 days ago.
    await db.execute(sql`delete from session_device d where coalesce(d.ended_at, d.last_active_at) < now() - interval '30 days'
      and not exists (select 1 from session s where s.id = d.session_id)`);
  } catch (e) {
    console.error("[sessions] recordDevice failed", e);
  }
}

/** Throttled "last used" stamp (at most once a minute per session). */
export async function touchActivity(sessionId: string) {
  await db
    .update(sessionDevice)
    .set({ lastActiveAt: sql`now()` })
    .where(and(eq(sessionDevice.sessionId, sessionId), lt(sessionDevice.lastActiveAt, sql`now() - interval '1 minute'`)))
    .catch(() => {});
}

/** From presence heartbeats; only used for wording ("tab in focus"), never for security. */
export async function setFocus(sessionId: string, focused: boolean) {
  await db
    .update(sessionDevice)
    .set({ isFocused: focused, lastActiveAt: sql`now()`, ...(focused ? { lastFocusedAt: sql`now()` } : {}) })
    .where(and(eq(sessionDevice.sessionId, sessionId), or(ne(sessionDevice.isFocused, focused), lt(sessionDevice.lastActiveAt, sql`now() - interval '1 minute'`))))
    .catch(() => {});
}

const columns = {
  sessionId: sessionDevice.sessionId,
  deviceLabel: sessionDevice.deviceLabel,
  city: sessionDevice.city,
  region: sessionDevice.region,
  country: sessionDevice.country,
  countryCode: sessionDevice.countryCode,
  isLocal: sessionDevice.isLocal,
  ip: sessionDevice.ip,
  createdAt: sessionDevice.createdAt,
  lastActiveAt: sessionDevice.lastActiveAt,
  isFocused: sessionDevice.isFocused,
  endedAt: sessionDevice.endedAt,
  revokedReason: sessionDevice.revokedReason,
  live: sql<boolean>`${session.id} is not null and ${session.expiresAt} > now()`,
};
export type DeviceRow = Awaited<ReturnType<typeof listDevices>>[number];

/** All devices of a user, live ones first. */
export async function listDevices(userId: string) {
  return db
    .select(columns)
    .from(sessionDevice)
    .leftJoin(session, eq(session.id, sessionDevice.sessionId))
    .where(eq(sessionDevice.userId, userId))
    .orderBy(desc(sql`${session.id} is not null`), desc(sessionDevice.lastActiveAt))
    .limit(30);
}

/** Other live sessions of this user used in the last TAKEOVER_WINDOW_MIN minutes. */
export async function openElsewhere(userId: string, currentSessionId: string) {
  return db
    .select(columns)
    .from(sessionDevice)
    .innerJoin(session, eq(session.id, sessionDevice.sessionId))
    .where(
      and(
        eq(sessionDevice.userId, userId),
        ne(sessionDevice.sessionId, currentSessionId),
        isNull(sessionDevice.endedAt),
        gt(session.expiresAt, sql`now()`),
        gt(sessionDevice.lastActiveAt, sql`now() - make_interval(mins => ${TAKEOVER_WINDOW_MIN})`),
      ),
    )
    .orderBy(desc(sessionDevice.lastActiveAt));
}

/**
 * Ends `targetId` (must belong to `userId`): deletes the Better Auth session, records why
 * and by whom, and tells the open tab over SSE. Idempotent.
 */
export async function endSession(userId: string, targetId: string, reason: "takeover" | "revoked", bySessionId: string) {
  const [by] = await db.select({ city: sessionDevice.city, deviceLabel: sessionDevice.deviceLabel, isLocal: sessionDevice.isLocal, country: sessionDevice.country }).from(sessionDevice).where(eq(sessionDevice.sessionId, bySessionId));
  const deleted = await db.delete(session).where(and(eq(session.id, targetId), eq(session.userId, userId))).returning({ id: session.id });
  await db
    .update(sessionDevice)
    .set({ endedAt: sql`coalesce(${sessionDevice.endedAt}, now())`, revokedReason: reason, endedBySessionId: bySessionId, isFocused: false })
    .where(and(eq(sessionDevice.sessionId, targetId), eq(sessionDevice.userId, userId)));
  if (deleted.length) {
    await emit({
      type: "session.revoked",
      userId,
      payload: { sessionId: targetId, reason, by: { city: by ? placeLabel(by) : null, deviceLabel: by?.deviceLabel ?? null } },
    });
  }
  return deleted.length > 0;
}

/** Why the session behind this (now dead) cookie token ended, if it was ended on purpose. */
export async function endedNotice(token: string) {
  const [row] = await db
    .select({ reason: sessionDevice.revokedReason, endedAt: sessionDevice.endedAt, by: sessionDevice.endedBySessionId })
    .from(sessionDevice)
    .where(eq(sessionDevice.tokenHash, tokenHash(token)));
  if (!row?.reason || row.reason === "signed_out") return null;
  const [by] = row.by
    ? await db.select({ deviceLabel: sessionDevice.deviceLabel, city: sessionDevice.city, country: sessionDevice.country, isLocal: sessionDevice.isLocal }).from(sessionDevice).where(eq(sessionDevice.sessionId, row.by))
    : [];
  return { reason: row.reason as "takeover" | "revoked", endedAt: row.endedAt, deviceLabel: by?.deviceLabel ?? null, place: by ? placeLabel(by) : null };
}

/** The raw session token from the admin cookie (secure or not), without its signature. */
export function cookieToken(get: (name: string) => string | undefined) {
  const raw = get("__Secure-qubo-admin.session_token") ?? get("qubo-admin.session_token");
  if (!raw) return null;
  const token = decodeURIComponent(raw).split(".")[0];
  return token || null;
}

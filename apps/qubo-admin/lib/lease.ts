import "server-only";
import { db } from "@qubo/db/client";
import { sql } from "drizzle-orm";
import type { LeaseHolder } from "@qubo/realtime";
import { getHub } from "@qubo/realtime/server";
import { emit } from "@/lib/events";

/**
 * Studio leases: exactly one editing tab per resource (`doc:<id>`). Every
 * transition is a single conditional statement so two tabs can never both
 * believe they hold it. See `studio_lease` for the timing rules.
 */
const TTL = "30 seconds";
const IDLE = "60 seconds";

type Row = { client_id: string; user_id: string; user_name: string; expires_at: Date; active_at: Date };
const holderOf = (r: Row | undefined): LeaseHolder | null => (r ? { clientId: r.client_id, userId: r.user_id, name: r.user_name } : null);

export async function currentHolder(resource: string) {
  const rows = await db.execute<Row>(sql`select * from studio_lease where resource = ${resource} and expires_at > now()`);
  return holderOf(rows[0]);
}

async function changed(siteId: string, resource: string, holder: LeaseHolder | null, by: LeaseHolder) {
  await emit({ type: "studio.lease.changed", siteId, payload: { resource, holder, by: { id: by.userId, name: by.name } } });
}

/** Takes the lease when it is free (or already ours). Returns the holder after the attempt. */
export async function acquire(siteId: string, resource: string, me: LeaseHolder) {
  const before = await currentHolder(resource);
  const rows = await db.execute<Row>(sql`
    insert into studio_lease (resource, site_id, client_id, user_id, user_name, expires_at)
    values (${resource}, ${siteId}, ${me.clientId}, ${me.userId}, ${me.name}, now() + ${TTL}::interval)
    on conflict (resource) do update set
      client_id = excluded.client_id, user_id = excluded.user_id, user_name = excluded.user_name,
      acquired_at = case when studio_lease.client_id = excluded.client_id then studio_lease.acquired_at else now() end,
      active_at = case when studio_lease.client_id = excluded.client_id then studio_lease.active_at else now() end,
      expires_at = excluded.expires_at
    where studio_lease.expires_at < now() or studio_lease.client_id = excluded.client_id
    returning *`);
  if (!rows[0]) return { holder: before };
  const holder = holderOf(rows[0])!;
  if (before?.clientId !== me.clientId) await changed(siteId, resource, holder, me);
  return { holder };
}

/** Holder heartbeat; `active` marks recent edits. Returns `lost` when someone else holds it now. */
export async function renew(resource: string, clientId: string, active: boolean) {
  const rows = await db.execute<Row>(sql`
    update studio_lease set expires_at = now() + ${TTL}::interval, active_at = case when ${active} then now() else active_at end
    where resource = ${resource} and client_id = ${clientId}
    returning *`);
  if (rows[0]) return { holder: holderOf(rows[0]) };
  return { holder: await currentHolder(resource), lost: true };
}

export async function release(siteId: string, resource: string, me: LeaseHolder) {
  const rows = await db.execute<Row>(sql`delete from studio_lease where resource = ${resource} and client_id = ${me.clientId} returning *`);
  if (rows[0]) await changed(siteId, resource, null, me);
  return { holder: null };
}

/**
 * Asks for control. Granted at once when the lease is free, expired, the
 * holder has been idle for a minute, or the holder is another tab of the
 * same user; otherwise the holder is asked (`studio.lease.requested`).
 */
export async function request(siteId: string, resource: string, me: LeaseHolder) {
  const rows = await db.execute<Row>(sql`
    update studio_lease set client_id = ${me.clientId}, user_id = ${me.userId}, user_name = ${me.name},
      acquired_at = now(), active_at = now(), expires_at = now() + ${TTL}::interval
    where resource = ${resource}
      and (expires_at < now() or active_at < now() - ${IDLE}::interval or user_id = ${me.userId})
    returning *`);
  if (rows[0]) {
    const holder = holderOf(rows[0])!;
    await changed(siteId, resource, holder, me);
    return { holder, granted: true };
  }
  const holder = await currentHolder(resource);
  if (!holder) return { ...(await acquire(siteId, resource, me)), granted: true };
  getHub().broadcast({ type: "studio.lease.requested", siteId, payload: { resource, from: me } });
  return { holder, granted: false };
}

/** The holder hands the lease to `to` (who asked for it). */
export async function grant(siteId: string, resource: string, me: LeaseHolder, to: LeaseHolder) {
  const rows = await db.execute<Row>(sql`
    update studio_lease set client_id = ${to.clientId}, user_id = ${to.userId}, user_name = ${to.name},
      acquired_at = now(), active_at = now(), expires_at = now() + ${TTL}::interval
    where resource = ${resource} and client_id = ${me.clientId}
    returning *`);
  if (!rows[0]) return { holder: await currentHolder(resource) };
  const holder = holderOf(rows[0])!;
  await changed(siteId, resource, holder, me);
  return { holder };
}

/** True (and marks activity) when `clientId` holds a live lease on `resource`. */
export async function holds(resource: string, clientId: string) {
  const rows = await db.execute(sql`
    update studio_lease set active_at = now()
    where resource = ${resource} and client_id = ${clientId} and expires_at > now()
    returning 1`);
  return rows.length > 0;
}

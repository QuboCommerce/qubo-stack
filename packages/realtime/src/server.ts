import postgres from "postgres";
import { CHANNEL, EPHEMERAL_TYPES, PlatformEvent, PresenceEntry, RETENTION_DAYS, visibleTo, type Audience, type DeliveredEvent } from "./index";

type Sql = postgres.Sql;
type Row = { id: string; type: string; site_id: string | null; org_id: string | null; user_id: string | null; payload: unknown; created_at: Date };

const toEvent = (r: Row) =>
  ({
    id: String(r.id),
    type: r.type,
    siteId: r.site_id ?? undefined,
    orgId: r.org_id ?? undefined,
    userId: r.user_id ?? undefined,
    payload: r.payload,
    createdAt: r.created_at.toISOString(),
  }) as DeliveredEvent;

/**
 * Durable insert + NOTIFY in one statement. The NOTIFY payload is only the id
 * (Postgres caps payloads at 8 kB); listeners load the row.
 */
export async function publish(sql: Sql, event: PlatformEvent): Promise<string> {
  const e = PlatformEvent.parse(event);
  if (EPHEMERAL_TYPES.has(e.type)) throw new Error(`${e.type} is ephemeral: use hub.broadcast`);
  if (!e.siteId && !e.orgId && !e.userId) throw new Error(`event ${e.type} has no scope (siteId/orgId/userId)`);
  const [row] = await sql<{ id: string }[]>`
    with e as (
      insert into platform_event (type, site_id, org_id, user_id, payload)
      values (${e.type}, ${e.siteId ?? null}, ${e.orgId ?? null}, ${e.userId ?? null}, ${sql.json(e.payload as postgres.JSONValue)})
      returning id
    )
    select id, pg_notify(${CHANNEL}, id::text) from e`;
  return String(row.id);
}

type Listener = { audience: Audience; send: (e: DeliveredEvent) => void };

/**
 * One LISTEN connection per process, fanned out to every subscriber whose
 * audience can see the event. Create it once (see `getHub`).
 */
export function createHub(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 0 });
  const listeners = new Set<Listener>();
  let lastPrune = 0;

  const ready = sql.listen(CHANNEL, async (id) => {
    if (!listeners.size) return;
    const [row] = await sql<Row[]>`select * from platform_event where id = ${id}`.catch(() => []);
    if (!row) return;
    const ev = toEvent(row);
    for (const l of listeners) if (visibleTo(ev, l.audience)) l.send(ev);
  });

  async function prune() {
    if (Date.now() - lastPrune < 3600_000) return;
    lastPrune = Date.now();
    await sql`delete from platform_event where created_at < now() - make_interval(days => ${RETENTION_DAYS})`.catch(() => {});
  }

  return {
    sql,
    ready,
    publish: (event: PlatformEvent) => publish(sql, event),
    /** Live-only delivery to this process's subscribers (no row, no NOTIFY). For ephemeral types. */
    broadcast(event: PlatformEvent) {
      const ev = { ...event, id: "", createdAt: new Date().toISOString() } as DeliveredEvent;
      for (const l of listeners) if (visibleTo(ev, l.audience)) l.send(ev);
    },
    subscribe(audience: Audience, send: (e: DeliveredEvent) => void) {
      const l = { audience, send };
      listeners.add(l);
      void prune();
      return () => listeners.delete(l);
    },
    /** Events after `sinceId` visible to the audience, oldest first. `gap` = the client is too far behind to replay. */
    async since(audience: Audience, sinceId: string, limit = 500) {
      const sites = [...audience.siteIds], orgs = [...audience.orgIds];
      const rows = await sql<Row[]>`
        select * from platform_event
        where id > ${sinceId}
          and (user_id = ${audience.userId}
            or (user_id is null and site_id = any(${sites}::text[]))
            or (user_id is null and site_id is null and org_id = any(${orgs}::text[])))
        order by id asc limit ${limit + 1}`;
      const [{ min }] = await sql<{ min: string | null }[]>`select min(id)::text as min from platform_event`;
      return {
        events: rows.slice(0, limit).map(toEvent),
        more: rows.length > limit,
        gap: min !== null && BigInt(sinceId) > BigInt(0) && BigInt(sinceId) < BigInt(min) - BigInt(1),
      };
    },
    async latestId() {
      const [{ max }] = await sql<{ max: string | null }[]>`select max(id)::text as max from platform_event`;
      return max ?? "0";
    },
    listenerCount: () => listeners.size,
  };
}

export type Hub = ReturnType<typeof createHub>;

const g = globalThis as unknown as { __quboHub?: Hub };
/** Process-wide hub (survives Next dev HMR). */
export function getHub(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  return (g.__quboHub ??= createHub(databaseUrl));
}

const enc = new TextEncoder();
const frame = (e: DeliveredEvent) =>
  enc.encode(`${e.id ? `id: ${e.id}\n` : ""}event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);

/**
 * Server-Sent Events response: replays from `Last-Event-ID` (or `?since=`), then
 * streams live. A comment every 25 s keeps proxies from closing the connection.
 * Sends `event: reset` when the client is too far behind to replay.
 */
export async function sseResponse(hub: Hub, audience: Audience, request: Request): Promise<Response> {
  await hub.ready;
  const url = new URL(request.url);
  const since = request.headers.get("last-event-id") ?? url.searchParams.get("since");
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: Uint8Array) => { try { controller.enqueue(chunk); } catch { cleanup(); } };
      // Subscribe first so nothing published during replay is lost; dedupe by id.
      let replayedUpTo = BigInt(0);
      const buffered: DeliveredEvent[] = [];
      let replaying = true;
      const fresh = (e: DeliveredEvent) => e.id === "" || BigInt(e.id) > replayedUpTo;
      const unsubscribe = hub.subscribe(audience, (e) => (replaying ? buffered.push(e) : fresh(e) && send(frame(e))));
      const ping = setInterval(() => send(enc.encode(`: ping\n\n`)), 25_000);
      cleanup = () => { clearInterval(ping); unsubscribe(); };
      request.signal.addEventListener("abort", () => { cleanup(); try { controller.close(); } catch {} });

      send(enc.encode(`retry: 3000\n\n`));
      if (since && /^\d+$/.test(since)) {
        const { events, more, gap } = await hub.since(audience, since);
        if (gap || more) send(enc.encode(`event: reset\ndata: {}\n\n`));
        else for (const e of events) { send(frame(e)); replayedUpTo = BigInt(e.id); }
      } else {
        // Fresh connection: tell the client where "now" is so a reconnect can resume.
        const latest = await hub.latestId();
        send(enc.encode(`id: ${latest}\nevent: ready\ndata: {}\n\n`));
        replayedUpTo = BigInt(latest);
      }
      replaying = false;
      for (const e of buffered) if (fresh(e)) send(frame(e));
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

/** JSON polling fallback: `GET …/poll?since=<id>`. */
export async function pollResponse(hub: Hub, audience: Audience, request: Request): Promise<Response> {
  const since = new URL(request.url).searchParams.get("since");
  if (!since || !/^\d+$/.test(since)) return Response.json({ events: [], cursor: await hub.latestId(), reset: false });
  const { events, more, gap } = await hub.since(audience, since);
  if (gap || more) return Response.json({ events: [], cursor: await hub.latestId(), reset: true });
  return Response.json({ events, cursor: events.at(-1)?.id ?? since, reset: false });
}

// ---------------------------------------------------------------- presence ---

export type PresenceInput = Omit<PresenceEntry, "at">;

/**
 * In-memory presence for one process. Tabs heartbeat with `touch`; entries expire
 * after `ttlMs`. Any change that matters to others broadcasts the site's snapshot
 * as `presence.changed`. Entries are keyed by user + client id, so a client can
 * only move its own entries.
 */
export function createPresence(hub: Pick<Hub, "broadcast">, { ttlMs = 90_000, sweepMs = 15_000 } = {}) {
  const entries = new Map<string, PresenceEntry & { expires: number }>();
  const key = (userId: string, clientId: string) => `${userId}\u0000${clientId}`;
  const strip = ({ expires: _, ...e }: PresenceEntry & { expires: number }): PresenceEntry => e;
  const shape = (e: PresenceInput) => [e.siteId, e.route, e.documentId, e.blockId, e.fieldPath, e.focused, e.name, e.image].join("\u0000");

  const snapshot = (siteId: string) => [...entries.values()].filter((e) => e.siteId === siteId).map(strip);
  const announce = (siteId: string) => hub.broadcast({ type: "presence.changed", siteId, payload: { entries: snapshot(siteId) } });

  const sweep = setInterval(() => {
    const now = Date.now(), sites = new Set<string>();
    for (const [k, e] of entries) if (e.expires <= now) { entries.delete(k); sites.add(e.siteId); }
    sites.forEach(announce);
  }, sweepMs);
  (sweep as { unref?: () => void }).unref?.();

  return {
    /** Records a heartbeat and returns the site's current snapshot. */
    touch(input: PresenceInput): PresenceEntry[] {
      const k = key(input.userId, input.clientId);
      const prev = entries.get(k);
      const now = Date.now();
      entries.set(k, { ...PresenceEntry.parse({ ...input, at: now }), expires: now + ttlMs });
      if (!prev || shape(prev) !== shape(input)) {
        announce(input.siteId);
        if (prev && prev.siteId !== input.siteId) announce(prev.siteId);
      }
      return snapshot(input.siteId);
    },
    leave(userId: string, clientId: string) {
      const prev = entries.get(key(userId, clientId));
      if (!prev) return;
      entries.delete(key(userId, clientId));
      announce(prev.siteId);
    },
    snapshot,
    stop: () => clearInterval(sweep),
  };
}

export type Presence = ReturnType<typeof createPresence>;

const gp = globalThis as unknown as { __quboPresence?: Presence };
/** Process-wide presence bound to `getHub()`. */
export const getPresence = () => (gp.__quboPresence ??= createPresence(getHub()));

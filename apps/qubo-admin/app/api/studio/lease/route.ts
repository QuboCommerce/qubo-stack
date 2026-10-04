import { db } from "@qubo/db/client";
import { document } from "@qubo/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { viewerOf } from "@/lib/audience";
import { acquire, grant, release, renew, request } from "@/lib/lease";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const id = z.string().min(1).max(100);
const Holder = z.object({ clientId: id, userId: id, name: z.string().max(200) });
const Body = z.object({
  op: z.enum(["acquire", "renew", "release", "request", "grant"]),
  siteId: id,
  documentId: z.uuid(),
  clientId: id,
  active: z.boolean().optional(),
  to: Holder.optional(),
});

/**
 * Studio document lease: acquire on open, renew every 10 s, release on
 * leave (`sendBeacon`), request / grant control. Always returns the holder.
 */
export async function POST(req: Request) {
  const viewer = await viewerOf(req.headers);
  if (!viewer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;
  if (!viewer.audience.siteIds.has(b.siteId)) return Response.json({ error: "forbidden" }, { status: 403 });

  const resource = `doc:${b.documentId}`;
  const me = { clientId: b.clientId, userId: viewer.user.id, name: viewer.user.name };

  if (b.op === "renew") return Response.json(await renew(resource, b.clientId, !!b.active));
  if (b.op === "release") return Response.json(await release(b.siteId, resource, me));

  const [doc] = await db.select({ id: document.id }).from(document).where(and(eq(document.id, b.documentId), eq(document.siteId, b.siteId))).limit(1);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });

  if (b.op === "acquire") return Response.json(await acquire(b.siteId, resource, me));
  if (b.op === "request") return Response.json(await request(b.siteId, resource, me));

  if (!b.to) return Response.json({ error: "invalid" }, { status: 400 });
  const member = await db.execute(sql`
    select 1 from organization_member m join site s on s.organization_id = m.organization_id
    where s.id = ${b.siteId} and m.user_id = ${b.to.userId} limit 1`);
  if (!member.length) return Response.json({ error: "forbidden" }, { status: 403 });
  return Response.json(await grant(b.siteId, resource, me, b.to));
}

import { db } from "@qubo/db/client";
import { document } from "@qubo/db/schema";
import { getHub } from "@qubo/realtime/server";
import { and, eq } from "drizzle-orm";
import type { Operation } from "fast-json-patch";
import { z } from "zod";
import { viewerOf } from "@/lib/audience";
import { holds } from "@/lib/lease";
import { applyOps, getLive, setSnapshot } from "@/lib/live-docs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const id = z.string().min(1).max(100);
const Op = z.object({ op: z.enum(["add", "remove", "replace", "move", "copy", "test"]), path: z.string(), from: z.string().optional(), value: z.unknown().optional() });
const Body = z.union([
  z.object({ siteId: id, documentId: z.uuid(), clientId: id, snapshot: z.unknown() }),
  z.object({ siteId: id, documentId: z.uuid(), clientId: id, epoch: id, seq: z.number().int().min(1), ops: z.array(Op).max(5000) }),
]);

async function siteOf(documentId: string, siteId: string) {
  const [doc] = await db.select({ id: document.id }).from(document).where(and(eq(document.id, documentId), eq(document.siteId, siteId))).limit(1);
  return !!doc;
}

/** Followers: the holder's current canvas (`null` until the holder has sent one). */
export async function GET(req: Request) {
  const viewer = await viewerOf(req.headers);
  if (!viewer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId") ?? "";
  const documentId = url.searchParams.get("documentId") ?? "";
  if (!viewer.audience.siteIds.has(siteId) || !z.uuid().safeParse(documentId).success || !(await siteOf(documentId, siteId))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json({ live: getLive(documentId) });
}

/** Holder: a full snapshot (start / resync) or the next JSON Patch batch. */
export async function POST(req: Request) {
  const viewer = await viewerOf(req.headers);
  if (!viewer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;
  if (!viewer.audience.siteIds.has(b.siteId)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!(await holds(`doc:${b.documentId}`, b.clientId))) return Response.json({ error: "not holder" }, { status: 409 });

  const by = { id: viewer.user.id, name: viewer.user.name };
  if ("snapshot" in b) {
    const res = setSnapshot(b.documentId, b.clientId, b.snapshot);
    getHub().broadcast({ type: "document.patched", siteId: b.siteId, payload: { documentId: b.documentId, epoch: res.epoch, seq: 0, ops: [], by } });
    return Response.json(res);
  }
  const res = applyOps(b.documentId, b.clientId, b.epoch, b.seq, b.ops as Operation[]);
  if ("resync" in res) return Response.json(res, { status: 409 });
  getHub().broadcast({ type: "document.patched", siteId: b.siteId, payload: { documentId: b.documentId, epoch: b.epoch, seq: b.seq, ops: b.ops, by } });
  return Response.json(res);
}

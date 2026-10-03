import { getPresence } from "@qubo/realtime/server";
import { z } from "zod";
import { viewerOf } from "@/lib/audience";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const id = z.string().min(1).max(100);
const Body = z.union([
  z.object({ clientId: id, siteId: id, leave: z.literal(true) }),
  z.object({
    clientId: id,
    siteId: id,
    route: z.string().max(500),
    documentId: id.optional(),
    blockId: z.string().max(200).optional(),
    fieldPath: z.string().max(200).optional(),
    focused: z.boolean(),
  }),
]);

/** Presence heartbeat (`fetch`) or leave (`sendBeacon` on pagehide). Returns the site's presence list. */
export async function POST(request: Request) {
  const viewer = await viewerOf(request.headers);
  if (!viewer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const body = parsed.data;
  if (!viewer.audience.siteIds.has(body.siteId)) return Response.json({ error: "forbidden" }, { status: 403 });

  const presence = getPresence();
  if ("leave" in body) {
    presence.leave(viewer.user.id, body.clientId);
    return new Response(null, { status: 204 });
  }
  const entries = presence.touch({ ...body, userId: viewer.user.id, name: viewer.user.name, image: viewer.user.image });
  return Response.json({ entries });
}

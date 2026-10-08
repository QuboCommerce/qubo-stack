import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { endSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const Body = z.object({ sessionIds: z.array(z.string().min(1).max(100)).min(1).max(20) });

/** Confirmed takeover: end the listed sessions of this user. Never automatic. */
export async function POST(request: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const ids = parsed.data.sessionIds.filter((id) => id !== s.session.id);
  for (const id of ids) await endSession(s.user.id, id, "takeover", s.session.id);
  return Response.json({ ok: true });
}

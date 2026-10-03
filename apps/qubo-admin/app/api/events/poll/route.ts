import { getHub, pollResponse } from "@qubo/realtime/server";
import { audienceOf } from "@/lib/audience";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Polling fallback when SSE is blocked: GET /api/events/poll?since=<id>. */
export async function GET(request: Request) {
  const audience = await audienceOf(request.headers);
  if (!audience) return Response.json({ error: "unauthorized" }, { status: 401 });
  return pollResponse(getHub(), audience, request);
}

import { getHub, sseResponse } from "@qubo/realtime/server";
import { audienceOf } from "@/lib/audience";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events for the panel (resume with Last-Event-ID or ?since=). */
export async function GET(request: Request) {
  const audience = await audienceOf(request.headers);
  if (!audience) return new Response("unauthorized", { status: 401 });
  return sseResponse(getHub(), audience, request);
}

import type { NextRequest } from "next/server";
import { forwardChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A file from the visitor's own chat; the API checks it belongs to them. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return forwardChat(req, `/files/${id}`);
}

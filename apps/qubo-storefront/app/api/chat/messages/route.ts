import type { NextRequest } from "next/server";
import { forwardChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

const MAX_BODY = 16 * 1024;

/** Visitor message; the first one mints the `qb_chat` cookie and opens the conversation. */
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return Response.json({ error: "too_large" }, { status: 413 });
  return forwardChat(req, "/messages", { mintToken: true });
}

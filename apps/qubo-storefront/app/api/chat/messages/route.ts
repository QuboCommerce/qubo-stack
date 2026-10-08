import type { NextRequest } from "next/server";
import { forwardChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

const MAX_TEXT = 16 * 1024;
/** Up to 3 files of 10 MB plus the text fields. */
const MAX_MULTIPART = 31 * 1024 * 1024;

/** Visitor message (JSON, or multipart with files); the first one mints the `qb_chat` cookie and opens the conversation. */
export async function POST(req: NextRequest) {
  const max = req.headers.get("content-type")?.startsWith("multipart/form-data") ? MAX_MULTIPART : MAX_TEXT;
  if (Number(req.headers.get("content-length") ?? 0) > max) return Response.json({ error: "too_large" }, { status: 413 });
  return forwardChat(req, "/messages", { mintToken: true });
}

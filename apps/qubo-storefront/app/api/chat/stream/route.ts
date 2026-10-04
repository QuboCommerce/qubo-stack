import type { NextRequest } from "next/server";
import { forwardChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** SSE: staff replies to the visitor's chat, live. */
export const GET = (req: NextRequest) => forwardChat(req, "/stream");

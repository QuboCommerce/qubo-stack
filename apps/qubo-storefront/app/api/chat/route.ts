import type { NextRequest } from "next/server";
import { forwardChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** The visitor's chat: public messages and who they are (read by the Chat block). */
export const GET = (req: NextRequest) => forwardChat(req, "");

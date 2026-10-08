import { LIMITS } from "@qubo/inbox";
import { uploadDraftFiles } from "@qubo/inbox/server";
import { storageConfigured, UPLOAD_PROFILES } from "@qubo/storage/server";
import { requireSite } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = LIMITS.replyFiles * Math.max(...Object.values(UPLOAD_PROFILES.inbox.maxBytes)) + 64_000;

/**
 * Reply attachments (multipart: `site`, `conversation`, `files`). Stored as
 * drafts of the uploader; the reply they're sent with claims them.
 */
export async function POST(req: Request) {
  if (!storageConfigured()) return Response.json({ error: "File storage isn't configured on this instance (STORAGE_DIR or STORAGE_ENDPOINT)." }, { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return Response.json({ error: "These files are too large together." }, { status: 413 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid upload." }, { status: 400 });
  const slug = form.get("site");
  const conversationId = form.get("conversation");
  if (typeof slug !== "string" || typeof conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(conversationId)) return Response.json({ error: "Invalid upload." }, { status: 400 });
  const { site, user } = await requireSite(slug);
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "No files." }, { status: 400 });
  const res = await uploadDraftFiles(
    site.id,
    conversationId,
    user.id,
    await Promise.all(files.map(async (f) => ({ filename: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))),
  );
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json({ attachments: res.attachments });
}

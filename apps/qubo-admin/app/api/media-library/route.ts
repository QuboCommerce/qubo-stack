import { uploadAsset, type MediaItem } from "@qubo/storage/media";
import { storageConfigured, UPLOAD_PROFILES } from "@qubo/storage/server";
import { requireSite } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILES = 20;
/** Whole request; the body is buffered, so keep it bounded. */
const MAX_REQUEST_BYTES = 2 * UPLOAD_PROFILES.media.maxBytes.video;

/**
 * Media upload (multipart: `site`, `scope` = site|shared, `files`). A route
 * handler, not a server action: actions cap bodies at 1 MB.
 */
export async function POST(req: Request) {
  if (!storageConfigured()) return Response.json({ error: "File storage isn't configured on this instance (STORAGE_DIR or STORAGE_ENDPOINT)." }, { status: 503 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BYTES) return Response.json({ error: "Upload fewer files at once (200 MB per batch)." }, { status: 413 });

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid upload." }, { status: 400 });
  const slug = form.get("site");
  if (typeof slug !== "string" || !slug) return Response.json({ error: "Missing site." }, { status: 400 });
  const { site, user } = await requireSite(slug);
  const shared = form.get("scope") === "shared";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No files." }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Up to ${MAX_FILES} files at once.` }, { status: 400 });

  const items: MediaItem[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const res = await uploadAsset({
      orgId: site.organizationId,
      siteId: shared ? null : site.id,
      userId: user.id,
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (res.ok) items.push(res.item);
    else errors.push(res.error);
  }
  return Response.json({ items, errors }, { status: items.length ? 200 : 400 });
}

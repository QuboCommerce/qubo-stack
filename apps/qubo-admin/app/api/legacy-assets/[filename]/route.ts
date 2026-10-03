import { readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename: encodedFilename } = await context.params;
  const filename = decodeURIComponent(encodedFilename);
  if (
    filename !== basename(filename) ||
    filename.includes("\0") ||
    !contentTypes[extname(filename).toLowerCase()]
  ) {
    return new Response("Not found", { status: 404 });
  }

  const root = process.env.LEGACY_ASSET_ROOT?.trim();
  if (!root) {
    return new Response("Legacy asset storage is not configured", {
      status: 503,
    });
  }

  try {
    const path = join(root, filename);
    const [buffer, metadata] = await Promise.all([readFile(path), stat(path)]);
    const etag = `"${createHash("sha256").update(buffer).digest("hex")}"`;
    return new Response(buffer, {
      headers: {
        "content-type": contentTypes[extname(filename).toLowerCase()],
        "content-length": String(metadata.size),
        "cache-control": "public, max-age=31536000, immutable",
        etag,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

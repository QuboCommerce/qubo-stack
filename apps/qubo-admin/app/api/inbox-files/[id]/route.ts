import { getInboxFile, serveInboxFile } from "@qubo/inbox/server";
import { requireSite } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** `GET /api/inbox-files/<id>?site=<slug>[&download=1]`: any member of the file's site. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const slug = url.searchParams.get("site");
  if (!slug || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { site } = await requireSite(slug);
  const row = await getInboxFile(id);
  if (!row || row.siteId !== site.id) return new Response("This file has expired.", { status: 410 });
  return serveInboxFile(row, { download: url.searchParams.get("download") === "1" });
}

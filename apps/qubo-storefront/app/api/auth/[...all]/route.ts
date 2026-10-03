import { forwardToApi } from "@/lib/api-forward";
import { requestHost } from "@/lib/hosts";
import { getStorefront } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Customer auth (Better Auth on qubo-api) for sites with the `accounts` capability. */
async function handle(req: Request) {
  const sf = await getStorefront(requestHost(req.headers));
  if (!sf || !sf.site.capabilities.includes("accounts")) return Response.json({ error: "not_found" }, { status: 404 });
  return forwardToApi(req, sf.site.slug, new URL(req.url).pathname);
}

export { handle as GET, handle as POST };

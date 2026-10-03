import { forwardToApi } from "@/lib/api-forward";
import { requestHost } from "@/lib/hosts";
import { getStorefront } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Signed-in customer's profile and orders for this site (read by the Account block). */
export async function GET(req: Request) {
  const sf = await getStorefront(requestHost(req.headers));
  if (!sf || !sf.site.capabilities.includes("accounts")) return Response.json({ error: "not_found" }, { status: 404 });
  return forwardToApi(req, sf.site.slug, "/account");
}

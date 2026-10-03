import { forwardToApi } from "@/lib/api-forward";
import { adminUrl } from "@qubo/shared/admin-url";
import { requestHost } from "@/lib/hosts";
import { getStorefront } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Signed-in customer's profile and orders for this site (read by the Account block). */
export async function GET(req: Request) {
  const sf = await getStorefront(requestHost(req.headers));
  if (!sf || !sf.site.capabilities.includes("accounts")) return Response.json({ error: "not_found" }, { status: 404 });
  const res = await forwardToApi(req, sf.site.slug, "/account");
  if (!res.ok) return res;
  // Staff: link to the panel with the e-mail prefilled (one-time handoff tokens come later).
  const { staff, ...data } = (await res.json()) as { staff?: boolean; user: { email: string } };
  const panelUrl = staff ? adminUrl(new URL(sf.origin).host, `/sign-in?email=${encodeURIComponent(data.user.email)}`) : undefined;
  return Response.json({ ...data, panelUrl }, { headers: { "cache-control": "no-store" } });
}

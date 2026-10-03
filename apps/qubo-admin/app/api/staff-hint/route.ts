import { registrableDomain, STAFF_HINT_COOKIE } from "@qubo/shared/admin-url";
import { staffFromHeaders } from "@/lib/staff";

/**
 * Sets/clears the non-secret `qubo_staff=<siteIds>` hint on the parent domain so
 * storefronts there render the Edit pen. It grants nothing: the pen still asks
 * /api/me, and the panel still needs its own host-only session.
 */
function hostOf(req: Request) {
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]!.trim();
}

function cookie(req: Request, value: string, maxAge: number) {
  const domain = registrableDomain(hostOf(req));
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return [
    `${STAFF_HINT_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    domain ? `Domain=${domain}` : null,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(req: Request) {
  const staff = await staffFromHeaders(req.headers);
  if (!staff || !staff.sites.length) return new Response(null, { status: 204, headers: { "Set-Cookie": cookie(req, "", 0) } });
  const ids = staff.sites.map((s) => s.id).join(".");
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie(req, ids, 60 * 60 * 24 * 30) } });
}

export async function DELETE(req: Request) {
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie(req, "", 0) } });
}

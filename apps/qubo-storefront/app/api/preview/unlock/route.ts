import { NextResponse, type NextRequest } from "next/server";
import { createStorefrontClient, QuboApiError } from "@qubo/storefront";
import { previewSiteHost, requestHost, siteTargets } from "@/lib/hosts";
import { GATE_PATH, PREVIEW_COOKIE } from "@/lib/preview";

export const dynamic = "force-dynamic";

/** PIN form target on preview hosts: asks the API for a site preview token and stores it as a cookie. */
export async function POST(req: NextRequest) {
  const host = requestHost(req.headers);
  const siteHost = previewSiteHost(host);
  if (!siteHost) return new NextResponse("Not found", { status: 404 });

  const form = await req.formData();
  const pin = String(form.get("pin") ?? "").replace(/\s+/g, "");
  const nextRaw = String(form.get("next") ?? "/");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  const gate = new URL(GATE_PATH, `https://${host}`);
  if (next !== "/") gate.searchParams.set("next", next);

  const noStore = (i: RequestInfo | URL, init?: RequestInit) => fetch(i, { ...init, cache: "no-store" });
  for (const target of siteTargets(siteHost)) {
    try {
      const { token, maxAge } = await createStorefrontClient({ ...target, host: siteHost, fetch: noStore }).unlockPreview(pin);
      const res = NextResponse.redirect(new URL(next, `https://${host}`), 303);
      res.cookies.set(PREVIEW_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });
      return res;
    } catch (error) {
      if (error instanceof QuboApiError && error.status === 400) continue; // site_not_resolved: try the next target
      if (error instanceof QuboApiError && error.status === 403) break;
      throw error;
    }
  }
  gate.searchParams.set("error", "1");
  return NextResponse.redirect(gate, 303);
}

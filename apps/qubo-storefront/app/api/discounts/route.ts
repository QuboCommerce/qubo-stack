import { QuboApiError } from "@qubo/storefront";
import { requestHost } from "@/lib/hosts";
import { getStorefront } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Cart → discount check. The API prices the cart itself; this only adds the site (by host). */
export async function POST(req: Request) {
  const sf = await getStorefront(requestHost(req.headers));
  if (!sf || !sf.site.capabilities.includes("commerce")) return Response.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { items?: unknown; code?: unknown } | null;
  if (!body || !Array.isArray(body.items) || typeof body.code !== "string" || !body.code.trim()) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    const result = await sf.client.checkDiscount(
      { code: body.code.trim().slice(0, 60), items: body.items as { variantId: string; quantity: number }[] },
      req.headers.get("cookie"),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof QuboApiError) return Response.json({ ok: false, reason: error.code }, { status: error.status >= 500 ? 502 : error.status });
    console.error("[discounts]", error);
    return Response.json({ ok: false, reason: "unavailable" }, { status: 502 });
  }
}

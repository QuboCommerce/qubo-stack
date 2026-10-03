import { QuboApiError } from "@qubo/storefront";
import { requestHost } from "@/lib/hosts";
import { getStorefront } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Cart → Stripe Checkout. The API re-validates and re-prices every line; this
 * route only adds the site (by host) and where Stripe should send the visitor back.
 */
export async function POST(req: Request) {
  const sf = await getStorefront(requestHost(req.headers));
  if (!sf || !sf.site.capabilities.includes("commerce")) return Response.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { items?: unknown } | null;
  if (!body || !Array.isArray(body.items)) return Response.json({ error: "invalid_cart" }, { status: 400 });

  // Same origin the visitor is on, so the success page sees (and clears) the same localStorage cart.
  const rawHost = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  const proto = (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")).split(",")[0].trim();

  try {
    const { url } = await sf.client.checkout({
      items: body.items as { variantId: string; quantity: number }[],
      returnOrigin: `${proto}://${rawHost}`,
    });
    return Response.json({ url });
  } catch (error) {
    if (error instanceof QuboApiError) {
      return Response.json({ error: error.code }, { status: error.status === 503 ? 503 : error.status >= 500 ? 502 : error.status });
    }
    console.error("[checkout]", error);
    return Response.json({ error: "checkout_failed" }, { status: 502 });
  }
}

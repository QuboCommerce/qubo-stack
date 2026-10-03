import { isAllowedStorefrontOrigin } from "@/lib/admin-host";
import { staffFromHeaders } from "@/lib/staff";

/**
 * Lets a storefront confirm the `qubo_staff` hint before showing the Edit pen.
 * CORS is an exact-origin allowlist (verified site domains; dev site hosts in dev).
 */
async function cors(req: Request): Promise<Record<string, string>> {
  const origin = req.headers.get("origin");
  const base = { Vary: "Origin", "Cache-Control": "no-store" };
  if (!origin || !(await isAllowedStorefrontOrigin(origin))) return base;
  return {
    ...base,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: await cors(req) });
}

export async function GET(req: Request) {
  const headers = await cors(req);
  const staff = await staffFromHeaders(req.headers);
  if (!staff) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  return Response.json(
    { user: { name: staff.user.name, email: staff.user.email, image: staff.user.image }, sites: staff.sites },
    { headers },
  );
}

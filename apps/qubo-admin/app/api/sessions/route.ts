import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { openElsewhere } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** Other sessions of the signed-in user that are open right now (sign-in takeover prompt). */
export async function GET() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const others = await openElsewhere(s.user.id, s.session.id);
  return Response.json(
    {
      others: others.map((o) => ({
        sessionId: o.sessionId,
        deviceLabel: o.deviceLabel,
        city: o.city,
        region: o.region,
        country: o.country,
        countryCode: o.countryCode,
        isLocal: o.isLocal,
        lastActiveAt: o.lastActiveAt.toISOString(),
        isFocused: o.isFocused,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

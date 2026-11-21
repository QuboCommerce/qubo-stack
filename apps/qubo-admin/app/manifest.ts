import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { siteForAdminHost } from "@/lib/admin-host";
import { navigationFor } from "@/lib/navigation";

const shortcutKeys = ["orders", "products", "inbox", "media"] as const;

/** "Add to Home Screen" gives a standalone panel named after the host's site. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const site = host ? await siteForAdminHost(host).catch(() => null) : null;
  const t = await getTranslations("nav");
  const items = site ? navigationFor(site.capabilities ?? []).flatMap((g) => g.items) : [];
  const shortcuts = shortcutKeys
    .map((key) => items.find((i) => i.key === key))
    .filter((i) => i !== undefined)
    .map((i) => ({ name: t(i.key), url: `/${site!.slug}${i.href}` }));
  return {
    id: "/",
    name: site ? `Qubo · ${site.name}` : "Qubo",
    short_name: site?.name ?? "Qubo",
    start_url: site ? `/${site.slug}` : "/",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts,
  };
}

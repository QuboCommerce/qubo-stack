import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteForAdminHost } from "@/lib/admin-host";

/** "Add to Home Screen" gives a standalone panel named after the host's site. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const site = host ? await siteForAdminHost(host).catch(() => null) : null;
  return {
    name: site ? `Qubo · ${site.name}` : "Qubo",
    short_name: site?.name ?? "Qubo",
    start_url: site ? `/${site.slug}` : "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

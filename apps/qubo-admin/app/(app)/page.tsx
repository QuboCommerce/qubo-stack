import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/page";
import { getUserSites } from "@/lib/admin";
import { siteForAdminHost } from "@/lib/admin-host";
import { Globe } from "lucide-react";

/** `qubo.<domain>` opens that domain's site; other hosts open the first site. */
export default async function Root() {
  const [sites, h] = await Promise.all([getUserSites(), headers()]);
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const hostSite = host ? await siteForAdminHost(host) : null;
  const target = sites.find((s) => s.id === hostSite?.id) ?? sites[0];
  if (target) redirect(`/${target.slug}`);
  return (
    <main className="grid min-h-dvh place-items-center">
      <EmptyState icon={Globe} title="No sites yet" description="Your account isn't linked to any organization site." />
    </main>
  );
}

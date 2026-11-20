import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/page";
import { getUserSites } from "@/lib/admin";
import { siteForAdminHost } from "@/lib/admin-host";
import { Globe } from "lucide-react";

/** `qubo.<domain>` opens that domain's site; other hosts open the first site the plan covers. */
export default async function Root() {
  const [sites, h, t] = await Promise.all([getUserSites(), headers(), getTranslations("dashboard.root")]);
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const hostSite = host ? await siteForAdminHost(host) : null;
  const target = sites.find((s) => s.id === hostSite?.id) ?? sites.find((s) => !s.locked) ?? sites[0];
  if (target) redirect(`/${target.slug}`);
  return (
    <main className="grid min-h-dvh place-items-center">
      <EmptyState icon={Globe} title={t("noSitesTitle")} description={t("noSitesDescription")} />
    </main>
  );
}

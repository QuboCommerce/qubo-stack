import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { db } from "@qubo/db/client";
import { organization } from "@qubo/db/schema";
import { inArray } from "drizzle-orm";
import { QuboMark, SiteAvatar } from "@/components/shell/qubo-mark";
import { Button } from "@/components/ui/button";
import { getAccess, getUserSites } from "@/lib/admin";

export const metadata = { title: "Not covered by your plan" };

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", growth: "Growth", agency: "Agency" };

/**
 * Where requireSite sends sites outside the instance's plan. Loads nothing from
 * the locked site beyond its name; the storefront keeps serving visitors.
 */
export default async function Locked({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site: slug } = await searchParams;
  const [sites, licence] = await Promise.all([getUserSites(), getAccess()]);
  const locked = sites.find((s) => s.slug === slug);
  if (!locked) notFound();
  if (!locked.locked) redirect(`/${locked.slug}`);

  const open = sites.filter((s) => !s.locked);
  const orgs = await db.select({ id: organization.id, name: organization.name }).from(organization).where(inArray(organization.id, [...new Set(sites.map((s) => s.organizationId))]));
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? "Organisation";
  const orgLocked = licence.lockedOrgIds.has(locked.organizationId);
  const plan = PLAN_LABEL[licence.entitlements.plan] ?? licence.entitlements.plan;
  const fmt = (q: { used: number; limit: number | null }, noun: string) => `${q.used} ${noun}${q.used === 1 ? "" : "s"}${q.limit === null ? "" : ` · plan covers ${q.limit}`}`;
  const portalHref = open[0] ? `/${open[0].slug}/settings/portal` : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <QuboMark className="mx-auto size-8" />
        <section className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <SiteAvatar name={locked.name} className="size-11 rounded-xl text-sm" />
              <span className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full border bg-background">
                <Lock className="size-3" strokeWidth={2.25} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{locked.name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{orgName(locked.organizationId)}</p>
            </div>
          </div>

          <h1 className="mt-5 text-lg font-semibold tracking-tight">
            {orgLocked ? "This organisation isn't covered by your plan" : "This site isn't covered by your plan"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This instance runs on <span className="font-medium text-foreground">{plan}</span>. {locked.name} stays online for visitors and nothing is deleted;
            editing opens again once your plan covers it.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-[13px]">
            <div><dt className="text-muted-foreground">Organisations</dt><dd className="font-medium">{fmt(licence.orgs, "org")}</dd></div>
            <div><dt className="text-muted-foreground">Sites</dt><dd className="font-medium">{fmt(licence.sites, "site")}</dd></div>
          </dl>

          {portalHref && (
            <Button asChild className="mt-5 w-full">
              <Link href={portalHref}>
                {licence.entitlements.source === "unlinked" ? "Link a Qubo Portal account" : "Upgrade in Qubo Portal"} <ArrowRight />
              </Link>
            </Button>
          )}
        </section>

        {open.length > 0 && (
          <section className="space-y-2">
            <p className="px-1 text-[13px] text-muted-foreground">Continue with a site on your plan</p>
            <div className="divide-y rounded-2xl border bg-background">
              {open.map((s) => (
                <Link key={s.id} href={`/${s.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-accent/40">
                  <SiteAvatar name={s.name} className="size-8 rounded-lg text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{orgName(s.organizationId)}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

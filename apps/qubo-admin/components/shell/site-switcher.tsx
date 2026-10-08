"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown, ExternalLink, Inbox, Lock, Plus, Search, Sparkles, Store } from "lucide-react";
import { cn } from "@qubo/shared/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { siteTypeIcon } from "@/lib/site-type-icons";
import { siteTypeLabel } from "@/lib/navigation";
import { CreateOrganizationDialog, CreateSiteDialog } from "./create-dialogs";
import { SiteAvatar } from "./qubo-mark";
import type { ShellAccess, ShellOrg, ShellSite } from "./types";

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", growth: "Growth", agency: "Agency" };

/** Keeps the current section when switching sites (/hm-froid/products → /tailg/products). */
function switchHref(pathname: string, from: string, to: string) {
  return `/${to}${pathname.slice(from.length + 1)}`;
}

/** Stacked list under 4 sites, two columns at 4, three at 6. */
function columnsFor(n: number) {
  return n >= 6 ? 3 : n >= 4 ? 2 : 1;
}

/**
 * A generated preview: the site's own theme colours laid out like a tiny
 * landing page behind browser chrome. No screenshots needed, and a brand
 * new site already looks like itself.
 */
function Thumbnail({ site, compact }: { site: ShellSite; compact: boolean }) {
  const { background, primary, text } = site.swatch;
  return (
    <div className={cn("relative overflow-hidden rounded-t-xl", compact ? "h-[4.25rem]" : "h-24")} style={{ background }}>
      <div className="absolute inset-x-0 top-0 flex h-4 items-center gap-1 px-2" style={{ background: `color-mix(in oklab, ${text} 8%, ${background})` }}>
        <span className="size-1.5 rounded-full bg-[#ff5f57]" />
        <span className="size-1.5 rounded-full bg-[#febc2e]" />
        <span className="size-1.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 h-1.5 flex-1 rounded-full opacity-20" style={{ background: text }} />
      </div>
      <div className="absolute inset-x-3 top-6 space-y-1.5">
        <div className="h-1.5 w-1/3 rounded-full opacity-70" style={{ background: text }} />
        <div className="h-1 w-2/3 rounded-full opacity-25" style={{ background: text }} />
        <div className="h-1 w-1/2 rounded-full opacity-25" style={{ background: text }} />
        <div className="mt-2 flex gap-1.5">
          <div className="h-3 w-10 rounded-sm" style={{ background: primary }} />
          <div className="h-3 w-10 rounded-sm opacity-30" style={{ background: text }} />
        </div>
      </div>
      <div className="absolute -right-4 -bottom-6 size-24 rounded-full opacity-90 blur-[1px]" style={{ background: `radial-gradient(circle at 30% 30%, ${primary}, color-mix(in oklab, ${primary} 60%, ${background}))` }} />
      {site.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={site.logo} alt="" className="absolute right-2 bottom-2 size-7 rounded-md object-cover shadow-sm ring-1 ring-black/10" />
      ) : (
        <SiteAvatar name={site.name} className="absolute right-2 bottom-2 size-7 rounded-md text-[10px] shadow-sm ring-1 ring-black/10" />
      )}
    </div>
  );
}

function SiteCard({ site, current, compact, pathname, currentSlug, onNavigate }: { site: ShellSite; current: boolean; compact: boolean; pathname: string; currentSlug: string; onNavigate: () => void }) {
  const Icon = siteTypeIcon[site.type] ?? Store;
  const href = site.locked ? `/locked?site=${encodeURIComponent(site.slug)}` : switchHref(pathname, currentSlug, site.slug);
  return (
    <div
      className={cn(
        "group/card relative flex flex-col rounded-xl border bg-card text-left shadow-xs transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md",
        current && "border-foreground/30 ring-1 ring-foreground/20",
        site.locked && "opacity-80",
      )}
    >
      <Link href={href} onClick={onNavigate} className="flex flex-1 flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Thumbnail site={site} compact={compact} />
        <div className="flex items-start gap-2.5 p-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold leading-tight">
              {site.name}
              {current && <Check className="size-3.5 shrink-0 text-muted-foreground" />}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Icon className="size-3 shrink-0" />
              {siteTypeLabel[site.type] ?? site.type}
              <span aria-hidden>·</span>
              {site.locked ? "Not in your plan" : site.published ? (site.domain ?? "Published") : "Draft"}
            </p>
          </div>
        </div>
      </Link>
      {site.locked ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-background/55 backdrop-blur-[2px]">
          <div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium shadow-sm">
            <Lock className="size-3" /> Upgrade to open
          </div>
        </div>
      ) : (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          {site.url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={site.url} target="_blank" rel="noreferrer" className="grid size-6 place-items-center rounded-md bg-background/90 shadow-sm ring-1 ring-black/10 hover:bg-background" aria-label="View site">
                  <ExternalLink className="size-3" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">View site</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      {!site.locked && site.unread > 0 && (
        <Link
          href={`/${site.slug}/inbox`}
          onClick={onNavigate}
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background shadow-sm hover:bg-foreground/90"
          aria-label={`${site.unread} unread in ${site.name}`}
        >
          <Inbox className="size-3" /> {site.unread}
        </Link>
      )}
    </div>
  );
}

export function SiteSwitcher({ site, sites, orgs, access }: { site: ShellSite; sites: ShellSite[]; orgs: ShellOrg[]; access: ShellAccess }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createSite, setCreateSite] = useState<{ orgId?: string } | null>(null);
  const [createOrg, setCreateOrg] = useState(false);
  const TypeIcon = siteTypeIcon[site.type] ?? Store;

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? sites.filter((s) => `${s.name} ${s.domain ?? ""} ${s.organization.name}`.toLowerCase().includes(q)) : sites), [sites, q]);
  const columns = columnsFor(sites.length);
  const compact = columns > 1;
  const groups = orgs.map((org) => ({ org, sites: visible.filter((s) => s.organization.id === org.id) })).filter((g) => !q || g.sites.length);
  const canManage = (org: ShellOrg) => !org.locked && (org.role === "OWNER" || org.role === "ADMIN");
  const planLabel = PLAN_LABEL[access.plan] ?? access.plan;
  const quota = (used: number, limit: number | null, noun: string) => `${used}${limit === null ? "" : ` of ${limit}`} ${noun}${used === 1 && limit === null ? "" : "s"}`;

  const openCreateSite = (orgId?: string) => {
    setOpen(false);
    setCreateSite({ orgId });
  };
  const openCreateOrg = () => {
    setOpen(false);
    setCreateOrg(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={(v) => (setOpen(v), v || setQuery(""))}>
        <PopoverTrigger
          className={cn(
            "group flex h-9 min-w-0 items-center gap-2 rounded-lg px-1.5 text-left text-topbar-foreground outline-none transition-colors",
            "hover:bg-topbar-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-topbar-muted",
          )}
        >
          <SiteAvatar name={site.name} className="size-6 rounded-md text-[10px]" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-tight">{site.name}</span>
            <span className="hidden items-center gap-1 text-[11px] leading-tight text-topbar-foreground/60 sm:flex">
              <TypeIcon className="size-3" /> {siteTypeLabel[site.type] ?? site.type}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-topbar-foreground/50" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "flex max-h-[min(80dvh,44rem)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 shadow-xl",
            columns === 1 && "sm:w-[22rem]",
            columns === 2 && "sm:w-[34rem]",
            columns === 3 && "sm:w-[48rem]",
          )}
        >
          {sites.length > 5 && (
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a site or organisation"
                className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="flex-1 space-y-4 overflow-y-auto p-3">
            {groups.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>}
            {groups.map(({ org, sites: orgSites }, gi) => (
              <section key={org.id} className="animate-in fade-in-0 slide-in-from-top-1 fill-mode-both duration-300" style={{ animationDelay: `${gi * 40}ms` }}>
                <header className="mb-2 flex items-center gap-2 px-0.5">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <h3 className="truncate text-xs font-semibold">{org.name}</h3>
                  {org.companyNumber && <span className="truncate text-[11px] tabular-nums text-muted-foreground">{org.companyNumber}</span>}
                  {org.locked && <Lock className="size-3 text-muted-foreground" />}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {orgSites.length} site{orgSites.length === 1 ? "" : "s"}
                  </span>
                </header>
                {orgSites.length ? (
                  <div className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3")}>
                    {orgSites.map((s, i) => (
                      <div key={s.slug} className="animate-in fade-in-0 zoom-in-95 fill-mode-both duration-300" style={{ animationDelay: `${gi * 40 + i * 30}ms` }}>
                        <SiteCard site={s} current={s.slug === site.slug} compact={compact} pathname={pathname} currentSlug={site.slug} onNavigate={() => setOpen(false)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!access.sites.canCreate || !canManage(org)}
                    onClick={() => openCreateSite(org.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:text-muted-foreground"
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-muted"><Sparkles className="size-4" /></span>
                    <span>
                      <span className="block font-medium text-foreground">No sites yet</span>
                      {org.locked ? "Outside your plan" : access.sites.canCreate ? "Create the first site in this organisation" : "Your plan's sites are all in use"}
                    </span>
                  </button>
                )}
              </section>
            ))}
          </div>
          <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-3 py-2.5">
            <p className="mr-auto text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{planLabel}</span> · {quota(access.sites.used, access.sites.limit, "site")} · {quota(access.orgs.used, access.orgs.limit, "organisation")}
            </p>
            <QuotaButton
              label="New organisation"
              icon={<Building2 className="size-3.5" />}
              disabled={!access.orgs.canCreate}
              reason={`Your ${planLabel} plan covers ${access.orgs.limit} organisation${access.orgs.limit === 1 ? "" : "s"}.`}
              upgradeHref={`/${site.slug}/settings/portal`}
              onClick={openCreateOrg}
              variant="ghost"
            />
            <QuotaButton
              label="New site"
              icon={<Plus className="size-3.5" />}
              disabled={!access.sites.canCreate || !orgs.some(canManage)}
              reason={access.sites.canCreate ? "You don't manage an organisation to put it in." : `Your ${planLabel} plan covers ${access.sites.limit} site${access.sites.limit === 1 ? "" : "s"}.`}
              upgradeHref={`/${site.slug}/settings/portal`}
              onClick={() => openCreateSite(site.organization.id)}
              variant="solid"
            />
          </footer>
        </PopoverContent>
      </Popover>
      <CreateSiteDialog open={createSite !== null} onOpenChange={(v) => !v && setCreateSite(null)} orgs={orgs} defaultOrgId={createSite?.orgId} />
      <CreateOrganizationDialog open={createOrg} onOpenChange={setCreateOrg} />
    </>
  );
}

function QuotaButton({ label, icon, disabled, reason, upgradeHref, onClick, variant }: { label: string; icon: React.ReactNode; disabled: boolean; reason: string; upgradeHref: string; onClick: () => void; variant: "ghost" | "solid" }) {
  const base = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors",
    variant === "solid" ? "bg-foreground text-background hover:bg-foreground/90" : "border bg-background hover:bg-muted",
  );
  if (!disabled) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {icon} {label}
      </button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={upgradeHref} className={cn(base, "opacity-70")}>
          <Lock className="size-3.5" /> {label}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-center">{reason} Open the portal to upgrade.</TooltipContent>
    </Tooltip>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Store } from "lucide-react";
import { siteTypeIcon } from "@/lib/site-type-icons";
import { cn } from "@qubo/shared/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { siteTypeLabel } from "@/lib/navigation";
import { SiteAvatar } from "./qubo-mark";
import type { ShellSite } from "./types";

/** Keeps the current section when switching sites (/hm-froid/products → /tailg/products). */
function switchHref(pathname: string, from: string, to: string) {
  const rest = pathname.slice(from.length + 1);
  return `/${to}${rest}`;
}

export function SiteSwitcher({ site, sites }: { site: ShellSite; sites: ShellSite[] }) {
  const pathname = usePathname();
  const TypeIcon = siteTypeIcon[site.type] ?? Store;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Sites</DropdownMenuLabel>
        {sites.map((s) => {
          const Icon = siteTypeIcon[s.type] ?? Store;
          return (
            <DropdownMenuItem key={s.slug} asChild className="gap-3 py-2">
              <Link href={switchHref(pathname, site.slug, s.slug)}>
                <SiteAvatar name={s.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Icon className="size-3" />
                    {siteTypeLabel[s.type] ?? s.type}
                    {s.domain && <> · {s.domain}</>}
                  </span>
                </span>
                {s.slug === site.slug && <Check className="size-4" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-3 py-2">
          <Link href={`/${site.slug}/settings/sites`}>
            <span className="grid size-7 place-items-center rounded-lg border border-dashed">
              <Plus className="size-4" />
            </span>
            Create a site
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

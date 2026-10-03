"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ExternalLink, Menu, Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandMenu } from "./command-menu";
import { QuboMark } from "./qubo-mark";
import { SidebarNav } from "./sidebar-nav";
import { SiteSwitcher } from "./site-switcher";
import type { ShellCounts, ShellSite, ShellUser } from "./types";
import { UserMenu } from "./user-menu";

/**
 * Responsive shell:
 *  - < md   : top bar + slide-over navigation (sheet), icon-only search
 *  - md–lg  : 64px icon rail with tooltips
 *  - lg+    : full 240px sidebar; 3xl widens it; page content adapts via container queries
 */
export function AdminFrame({ site, sites, user, counts, children }: {
  site: ShellSite;
  sites: ShellSite[];
  user: ShellUser;
  counts: ShellCounts;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-sidebar">
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-1 bg-topbar px-2 text-topbar-foreground xs:gap-2 sm:px-3 lg:px-4">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid size-9 place-items-center rounded-lg hover:bg-topbar-muted md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <Link href={`/${site.slug}`} className="hidden items-center gap-2 rounded-lg px-1 xs:flex lg:w-[13.5rem] 3xl:w-[15rem]" aria-label="Qubo home">
            <QuboMark className="size-7" />
            <span className="hidden text-[15px] font-semibold tracking-tight lg:inline">Qubo</span>
          </Link>
          <span className="hidden h-5 w-px bg-topbar-muted md:block lg:hidden" />
          <div className="min-w-0 shrink">
            <SiteSwitcher site={site} sites={sites} />
          </div>

          <div className="mx-auto hidden w-full max-w-md flex-1 justify-center px-2 md:flex xl:max-w-xl 3xl:max-w-2xl">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 bg-topbar-muted px-3 text-[13px] text-topbar-foreground/60 transition-colors hover:border-white/20 hover:text-topbar-foreground/80"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search</span>
              <Kbd className="border-white/10 bg-white/10 text-topbar-foreground/70">⌘K</Kbd>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-0.5 md:ml-0">
            <button type="button" onClick={() => setSearchOpen(true)} className="grid size-9 place-items-center rounded-lg hover:bg-topbar-muted md:hidden" aria-label="Search">
              <Search className="size-[18px]" />
            </button>
            {site.url && (
              <a
                href={site.url}
                target="_blank"
                rel="noreferrer"
                className="hidden size-9 place-items-center rounded-lg hover:bg-topbar-muted sm:grid"
                aria-label="View live site"
              >
                <ExternalLink className="size-[18px]" />
              </a>
            )}
            <button type="button" className="relative grid size-9 place-items-center rounded-lg hover:bg-topbar-muted" aria-label="Notifications">
              <Bell className="size-[18px]" />
              {counts.leads > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-hot ring-2 ring-topbar" />}
            </button>
            <UserMenu user={user} />
          </div>
        </header>

        <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-16 bg-sidebar md:block lg:w-60 3xl:w-64">
          <div className="h-full lg:hidden">
            <SidebarNav site={site} counts={counts} mode="rail" />
          </div>
          <div className="hidden h-full lg:block">
            <SidebarNav site={site} counts={counts} mode="full" />
          </div>
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-[18rem] max-w-[85vw] gap-0 border-0 bg-sidebar p-0">
            <SheetTitle className="flex h-14 items-center gap-2 px-4 text-[15px]">
              <QuboMark className="size-7" /> Qubo
            </SheetTitle>
            <div className="min-h-0 flex-1">
              <SidebarNav site={site} counts={counts} mode="full" onNavigate={() => setNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <main className="min-h-dvh pt-14 md:pl-16 lg:pl-60 3xl:pl-64">
          <div className="@container min-h-[calc(100dvh-3.5rem)] bg-background md:rounded-tl-2xl md:border-l md:border-t md:border-sidebar-border">
            {children}
          </div>
        </main>

        <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} site={site} sites={sites} />
      </div>
    </TooltipProvider>
  );
}

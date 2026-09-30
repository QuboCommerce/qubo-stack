"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@peltier/shared/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navigationFor, settingsItem, type NavItem } from "@/lib/navigation";
import type { ShellCounts, ShellSite } from "./types";

type Mode = "full" | "rail";

function isActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Item({ item, base, pathname, mode, counts, onNavigate }: {
  item: NavItem;
  base: string;
  pathname: string;
  mode: Mode;
  counts: ShellCounts;
  onNavigate?: () => void;
}) {
  const href = `${base}${item.href}`;
  const active = isActive(pathname, href, item.href === "");
  const Icon = item.icon;
  const badge = item.badge ? counts[item.badge] : 0;

  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium text-sidebar-foreground transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[0_1px_0_0_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)] hover:bg-sidebar-primary",
        mode === "rail" && "size-10 justify-center px-0",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/80")} strokeWidth={active ? 2.3 : 2} />
      {mode === "full" && <span className="truncate">{item.label}</span>}
      {badge > 0 &&
        (mode === "full" ? (
          <span className="ml-auto rounded-md bg-sidebar-accent px-1.5 text-[11px] font-semibold tabular-nums text-sidebar-accent-foreground group-aria-[current=page]/nav:bg-sidebar-accent">
            {badge}
          </span>
        ) : (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-hot ring-2 ring-sidebar" />
        ))}
    </Link>
  );

  if (mode === "rail") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  const sectionActive = isActive(pathname, href, item.href === "");
  return (
    <div>
      {link}
      {sectionActive && item.children && item.children.length > 0 && (
        <div className="relative mb-1 mt-0.5 space-y-0.5 pl-[1.625rem]">
          {item.children.map((child) => {
            const childHref = `${base}${child.href}`;
            const childActive = child.href === item.href ? pathname === childHref : isActive(pathname, childHref);
            return (
              <Link
                key={child.href}
                href={childHref}
                onClick={onNavigate}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex h-7 items-center rounded-md px-2 text-[13px] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  childActive && "font-semibold text-sidebar-accent-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ site, counts, mode, onNavigate }: {
  site: ShellSite;
  counts: ShellCounts;
  mode: Mode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const base = `/${site.slug}`;
  const groups = navigationFor(site.capabilities);

  return (
    <nav aria-label="Main" className={cn("flex h-full flex-col", mode === "rail" ? "items-center px-2 py-3" : "px-3 py-3")}>
      <div className="flex-1 space-y-5 overflow-y-auto">
        {groups.map((group, i) => (
          <div key={group.label ?? i} className="space-y-0.5">
            {group.label &&
              (mode === "full" ? (
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">{group.label}</p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
              ))}
            {group.items.map((item) => (
              <Item key={item.href} item={item} base={base} pathname={pathname} mode={mode} counts={counts} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </div>
      <div className={cn("pt-3", mode === "full" && "border-t border-sidebar-border")}>
        <Item item={settingsItem} base={base} pathname={pathname} mode={mode} counts={counts} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

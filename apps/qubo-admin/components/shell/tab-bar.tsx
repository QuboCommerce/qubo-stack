"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid } from "lucide-react";
import { cn } from "@qubo/shared/utils";
import { navigationFor, type NavItem } from "@/lib/navigation";
import type { ShellCounts, ShellSite } from "./types";

// Thumb row on phones: Home, the three busiest sections this site has, then everything else.
const priority = ["orders", "products", "bookings", "inbox", "content", "media"] as const;

const isActive = (pathname: string, href: string, exact: boolean) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export function TabBar({ site, counts, moreOpen, onMore }: {
  site: ShellSite;
  counts: ShellCounts;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const pathname = usePathname();
  const base = `/${site.slug}`;
  const items = navigationFor(site.capabilities).flatMap((g) => g.items);
  const home = items.find((i) => i.key === "home");
  const tabs = [
    ...(home ? [home] : []),
    ...priority
      .map((key) => items.find((i) => i.key === key))
      .filter((i): i is NavItem => i !== undefined)
      .slice(0, 3),
  ];
  const onTab = tabs.some((i) => isActive(pathname, `${base}${i.href}`, i.href === ""));

  return (
    <nav
      aria-label={tShell("tabBar")}
      className="qb-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-lg px-[max(0.25rem,env(safe-area-inset-left))]" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((item) => {
          const href = `${base}${item.href}`;
          const active = isActive(pathname, href, item.href === "");
          const badge = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.key}>
              <Link href={href} aria-current={active ? "page" : undefined} className="qb-tab group">
                <Glyph icon={item.icon} active={active} badge={badge} />
                <span className="max-w-full truncate">{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMore} aria-expanded={moreOpen} aria-current={!onTab ? "page" : undefined} className="qb-tab group">
            <Glyph icon={LayoutGrid} active={moreOpen || !onTab} badge={0} />
            <span className="max-w-full truncate">{tShell("more")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Glyph({ icon: Icon, active, badge }: { icon: NavItem["icon"]; active: boolean; badge: number }) {
  return (
    <span className={cn("relative grid h-7 w-12 place-items-center rounded-full transition-colors duration-200", active && "bg-foreground/[0.08]")}>
      <Icon className="size-[21px]" strokeWidth={active ? 2.25 : 1.75} />
      {badge > 0 && (
        <span className="absolute -top-0.5 left-[calc(50%+0.375rem)] min-w-4 rounded-full bg-brand-hot px-1 text-center text-[10px] font-semibold leading-4 text-white tabular-nums ring-2 ring-background">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </span>
  );
}

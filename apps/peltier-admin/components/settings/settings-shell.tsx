"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { cn } from "@peltier/shared/utils";
import { visibleGroups } from "./sections";

/**
 * Settings frame. Wide containers: sticky list on the left, page on the right.
 * Narrow containers: the index *is* the list; sub-pages take the full width.
 */
export function SettingsShell({ site, capabilities, children }: { site: string; capabilities: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/${site}/settings`;
  const isIndex = pathname === base;
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibleGroups(capabilities)
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => !needle || `${i.label} ${i.description} ${g.label}`.toLowerCase().includes(needle)),
      }))
      .filter((g) => g.items.length);
  }, [capabilities, q]);

  return (
    <div className="mx-auto w-full max-w-6xl px-0 pb-16 pt-4 xs:px-3 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8 2xl:max-w-7xl 3xl:max-w-8xl 3xl:px-10 4xl:max-w-9xl 4xl:px-14">
      <div className="@container">
        <div className="gap-8 @min-[52rem]:grid @min-[52rem]:grid-cols-[13.5rem_minmax(0,1fr)] @min-[80rem]:grid-cols-[15rem_minmax(0,1fr)] @min-[80rem]:gap-12">
          <aside className={cn(!isIndex && "hidden @min-[52rem]:block")}>
            <div className="@min-[52rem]:sticky @min-[52rem]:top-[4.5rem]">
              <h1 className="mb-3 px-3 text-xl font-semibold tracking-tight xs:px-0 sm:text-[1.375rem] @min-[52rem]:mb-4 @min-[52rem]:px-2 @min-[52rem]:text-base">
                Settings
              </h1>
              <label className="relative mx-3 mb-4 block xs:mx-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search settings"
                  className="h-8 w-full rounded-lg border border-transparent bg-foreground/[0.05] pl-8 pr-7 text-[13px] outline-none transition placeholder:text-muted-foreground focus:border-ring focus:bg-card"
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground" aria-label="Clear">
                    <X className="size-3.5" />
                  </button>
                )}
              </label>
              <nav className="space-y-5" aria-label="Settings">
                {groups.map((g) => (
                  <div key={g.label}>
                    <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground xs:px-0 @min-[52rem]:px-2">{g.label}</p>
                    {/* phones: one card per group, rows with chevrons. wide: flat list. */}
                    <ul className="overflow-hidden bg-card shadow-[0_0_0_1px_var(--color-border)] xs:rounded-xl @min-[52rem]:bg-transparent @min-[52rem]:shadow-none">
                      {g.items.map((i) => {
                        const href = `${base}/${i.slug}`;
                        const active = pathname === href || pathname.startsWith(`${href}/`);
                        return (
                          <li key={i.slug} className="border-b last:border-b-0 @min-[52rem]:border-0">
                            <Link
                              href={href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "group flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/60",
                                "@min-[52rem]:gap-2.5 @min-[52rem]:rounded-lg @min-[52rem]:px-2 @min-[52rem]:py-1.5 @min-[52rem]:text-[13px]",
                                active && "@min-[52rem]:bg-card @min-[52rem]:font-semibold @min-[52rem]:shadow-[0_1px_0_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.05)]",
                              )}
                            >
                              <i.icon className={cn("size-4 shrink-0 text-muted-foreground", active && "text-foreground")} strokeWidth={active ? 2.2 : 1.8} />
                              <span className="flex-1 truncate">{i.label}</span>
                              <ChevronRight className="size-4 text-muted-foreground/60 @min-[52rem]:hidden" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {groups.length === 0 && <p className="px-3 text-[13px] text-muted-foreground xs:px-0 @min-[52rem]:px-2">No settings match “{q}”.</p>}
              </nav>
            </div>
          </aside>
          <div className={cn("min-w-0", isIndex && "hidden @min-[52rem]:block")}>{children}</div>
        </div>
      </div>
    </div>
  );
}

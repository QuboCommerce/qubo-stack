import type React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@qubo/shared/utils";

/** Shopify-style view tabs + search, driven by URL search params (works without JS). */
export function IndexToolbar({
  basePath,
  tabs,
  active,
  q,
  placeholder = "Search",
  keep,
  extra,
}: {
  basePath: string;
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  q?: string;
  placeholder?: string;
  /** Extra query params preserved by tabs and search (e.g. the view mode). */
  keep?: Record<string, string>;
  /** Rendered after the search box. */
  extra?: React.ReactNode;
}) {
  const keepQs = keep ? Object.entries(keep).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("") : "";
  return (
    <div className="flex flex-col gap-2 border-b px-2 py-2 @min-[40rem]:flex-row @min-[40rem]:items-center">
      <nav className="-mx-0.5 flex gap-0.5 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`${basePath}?status=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}${keepQs}`}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
              active === t.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && <span className="text-xs tabular-nums text-muted-foreground">{t.count}</span>}
          </Link>
        ))}
      </nav>
      <form className="relative @min-[40rem]:ml-auto @min-[40rem]:w-64 @min-[80rem]:w-80" action={basePath}>
        <input type="hidden" name="status" value={active} />
        {keep && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="h-8 w-full rounded-lg border bg-background pl-8 pr-3 text-[13px] outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
      </form>
      {extra}
    </div>
  );
}

export function Pagination({ href, page, perPage, total }: { href: (page: number) => string; page: number; perPage: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(total, page * perPage);
  const btn = "grid size-8 place-items-center rounded-lg border bg-card transition-colors hover:bg-accent";
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} of {new Intl.NumberFormat("en-BE").format(total)}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link className={btn} href={href(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Link>
        ) : (
          <span className={cn(btn, "opacity-40")}><ChevronLeft className="size-4" /></span>
        )}
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        {page < pages ? (
          <Link className={btn} href={href(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Link>
        ) : (
          <span className={cn(btn, "opacity-40")}><ChevronRight className="size-4" /></span>
        )}
      </div>
    </div>
  );
}

export const th = "h-10 px-3 text-left text-xs font-medium text-muted-foreground first:pl-4 last:pr-4 whitespace-nowrap";
export const td = "px-3 py-2.5 first:pl-4 last:pr-4 align-middle";

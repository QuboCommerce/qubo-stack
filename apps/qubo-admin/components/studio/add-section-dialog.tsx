"use client";

import { useMemo, useState } from "react";
import { Blocks, Lock, Search, Sparkles, X } from "lucide-react";
import { registry } from "@qubo/blocks";
import { cn } from "@qubo/shared/utils";
import { BlockFrame } from "@/components/block-frame";
import { capabilityMeta } from "@/components/settings/capabilities";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { sectionCatalog, sectionGroups, type SectionEntry, type SectionGroupId } from "@/lib/section-catalog";

type Tab = "library" | "generate";

/**
 * Shopify's "Add section", with live thumbnails: every card is the real
 * section rendered by the canvas route under the site's theme.
 */
export function AddSectionDialog({
  open,
  onOpenChange,
  siteSlug,
  capabilities,
  insertAfter,
  themeName,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteSlug: string;
  capabilities: readonly string[];
  /** Label of the section the new one goes after; null = end of page. */
  insertAfter: string | null;
  themeName?: string;
  onInsert: (entry: SectionEntry) => void;
}) {
  const [tab, setTab] = useState<Tab>("library");
  const [group, setGroup] = useState<SectionGroupId | "all">("all");
  const [query, setQuery] = useState("");

  const catalog = useMemo(() => sectionCatalog(registry, capabilities), [capabilities]);
  const q = query.trim().toLowerCase();
  const matches = catalog.filter((e) => (!q || q.split(/\s+/).every((w) => e.search.includes(w))) && (group === "all" || e.group === group));
  // Available sections first inside each group; locked ones stay discoverable.
  const sorted = [...matches].sort((a, b) => Number(a.missing.length > 0) - Number(b.missing.length > 0));
  const counts = Object.fromEntries(sectionGroups.map((g) => [g.id, catalog.filter((e) => e.group === g.id).length]));
  const groups = sectionGroups.filter((g) => counts[g.id]);
  const grouped = group === "all" && !q;

  const card = (e: SectionEntry) => {
    const locked = e.missing.length > 0;
    const needs = e.missing.map((c) => capabilityMeta[c]?.label ?? c).join(", ");
    return (
      <button
        key={e.key}
        type="button"
        disabled={locked}
        onClick={() => onInsert(e)}
        title={locked ? `Turn on ${needs} in Settings to use this section` : `Add ${e.label}${e.variant ? ` · ${e.variant}` : ""}`}
        className={cn(
          "group flex flex-col overflow-hidden rounded-xl bg-card text-left shadow-[0_0_0_1px_var(--color-border)] transition-[box-shadow,transform] outline-none",
          locked
            ? "cursor-not-allowed opacity-55"
            : "hover:-translate-y-px hover:shadow-[0_0_0_1.5px_var(--color-foreground),0_10px_28px_-14px_rgb(0_0_0/0.35)] focus-visible:shadow-[0_0_0_2px_var(--color-ring)]",
        )}
      >
        <BlockFrame
          src={`/canvas/${siteSlug}/${e.type}?thumb=1${e.preset ? `&preset=${e.preset}` : ""}`}
          title={`${e.label} preview`}
          height={150}
          virtualWidth={e.thumbWidth}
          className="border-b"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
            <span className="truncate">{e.label}</span>
            {e.variant && <span className="truncate font-normal text-muted-foreground">· {e.variant}</span>}
            {locked && <Lock className="ml-auto size-3 shrink-0 text-muted-foreground" aria-hidden />}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{locked ? `Needs ${needs}` : e.description}</p>
        </div>
      </button>
    );
  };

  const grid = (items: SectionEntry[]) => (
    <div className="grid grid-cols-1 gap-3 @min-[30rem]:grid-cols-2 @min-[52rem]:grid-cols-3 @min-[80rem]:grid-cols-4 @min-[110rem]:grid-cols-5">
      {items.map(card)}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(56rem,90dvh)] sm:w-[min(94vw,76rem)] sm:max-w-none sm:rounded-2xl sm:border 3xl:w-[min(92vw,104rem)] 4xl:w-[min(90vw,136rem)]"
      >
        {/* header */}
        <div className="flex shrink-0 flex-col gap-3 border-b px-4 pt-4 pb-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold">Add section</DialogTitle>
              <DialogDescription className="truncate text-xs">
                {insertAfter ? <>Goes after <span className="font-medium text-foreground">{insertAfter}</span></> : "Goes at the end of the page"}
                {themeName && <> · previews use {themeName}</>}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div role="tablist" className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
              {(
                [
                  ["library", "Library", Blocks],
                  ["generate", "Generate", Sparkles],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
                    tab === id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
            {tab === "library" && (
              <label className="relative sm:ml-auto sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Search sections"
                  aria-label="Search sections"
                  className="h-8 w-full rounded-lg border bg-background pr-3 pl-8 text-[13px] outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
            )}
          </div>
        </div>

        {tab === "library" ? (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* categories: chips on phones, a rail from md */}
            <nav
              aria-label="Section categories"
              className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 md:w-52 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:py-3 3xl:w-60"
            >
              {[{ id: "all" as const, label: "All sections" }, ...groups].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                    group === g.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <span className="flex-1">{g.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{g.id === "all" ? catalog.length : counts[g.id]}</span>
                </button>
              ))}
            </nav>

            <div className="@container min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {sorted.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 py-16 text-center">
                  <Search className="mb-2 size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">No sections match “{query}”</p>
                  <p className="text-xs text-muted-foreground">Try another word, or describe it in Generate.</p>
                </div>
              ) : grouped ? (
                <div className="space-y-7">
                  {groups.map((g) => (
                    <section key={g.id} aria-labelledby={`sg-${g.id}`}>
                      <h3 id={`sg-${g.id}`} className="mb-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {g.label}
                      </h3>
                      {grid(sorted.filter((e) => e.group === g.id))}
                    </section>
                  ))}
                </div>
              ) : (
                grid(sorted)
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="flex max-w-md flex-col items-center gap-3 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <h3 className="text-base font-semibold">Generate a section</h3>
              <p className="text-sm text-muted-foreground">
                Describe what you need and the assistant composes it from this library, in your theme. You preview it before anything is added.
              </p>
              <textarea
                disabled
                rows={3}
                placeholder="A three-step process explaining how a cold room is installed…"
                className="mt-1 w-full resize-none rounded-lg border bg-muted/40 p-3 text-sm outline-none"
              />
              <p className="text-xs text-muted-foreground">Coming soon with Puck AI.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

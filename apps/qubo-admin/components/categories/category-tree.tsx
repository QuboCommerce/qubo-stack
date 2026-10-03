"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@qubo/shared/utils";

export type TreeItem = { id: string; name: string; parentId: string | null; depth: number; total: number; childCount: number };

type LinkMode = { mode: "link"; hrefBase: string; selectedId?: string };
type SelectMode = { mode: "select"; name: string; defaultSelected: string[] };

/**
 * Collapsible, searchable category tree. In "select" mode it renders native
 * checkboxes: rows hidden by collapse or search stay in the DOM so they still
 * submit, and form.reset() restores them.
 */
export function CategoryTree({ items, className, ...props }: { items: TreeItem[]; className?: string } & (LinkMode | SelectMode)) {
  const byId = useMemo(() => new Map(items.map((n) => [n.id, n])), [items]);
  const ancestors = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const n of items) {
      const parent = n.parentId && byId.has(n.parentId) ? n.parentId : null;
      out.set(n.id, parent ? [...(out.get(parent) ?? []), parent] : []);
    }
    return out;
  }, [items, byId]);
  const paths = useMemo(() => {
    const out = new Map<string, string>();
    for (const n of items) out.set(n.id, [...(ancestors.get(n.id) ?? []).map((a) => byId.get(a)!.name), n.name].join(" › "));
    return out;
  }, [items, ancestors, byId]);

  const initialOpen = props.mode === "link" ? (props.selectedId ? [props.selectedId] : []) : props.defaultSelected;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialOpen.flatMap((id) => ancestors.get(id) ?? [])));
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(props.mode === "select" ? props.defaultSelected : []));
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const defaultKey = props.mode === "select" ? props.defaultSelected.join(",") : "";

  // Keep the chip summary in sync when the surrounding form is discarded.
  useEffect(() => {
    if (props.mode !== "select") return;
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setChecked(new Set(defaultKey ? defaultKey.split(",") : []));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [props.mode, defaultKey]);

  // Typing in the filter is not an edit: stop it natively so the form's save bar doesn't appear.
  useEffect(() => {
    const el = searchRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("input", stop);
    el.addEventListener("change", stop);
    return () => {
      el.removeEventListener("input", stop);
      el.removeEventListener("change", stop);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    const visible = new Set<string>();
    for (const n of items) {
      if (n.name.toLowerCase().includes(q)) {
        visible.add(n.id);
        for (const a of ancestors.get(n.id) ?? []) visible.add(a);
      }
    }
    return visible;
  }, [q, items, ancestors]);

  const isVisible = (n: TreeItem) => (matches ? matches.has(n.id) : (ancestors.get(n.id) ?? []).every((a) => expanded.has(a)));
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = expanded.size > 0;
  const inputId = (id: string) => `cat-${id}`;

  return (
    <div ref={rootRef} className={cn("flex min-h-0 flex-col", className)}>
      {props.mode === "select" && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {checked.size === 0 ? (
            <p className="text-xs text-muted-foreground">No category yet. Uncategorised products don't appear on category pages.</p>
          ) : (
            [...checked].map((id) => (
              <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent py-0.5 pl-2 pr-0.5 text-xs">
                <span className="truncate" title={paths.get(id)}>{paths.get(id) ?? "Unknown"}</span>
                <button
                  type="button"
                  aria-label={`Remove ${byId.get(id)?.name ?? "category"}`}
                  onClick={() => document.getElementById(inputId(id))?.click()}
                  className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter categories"
            aria-label="Filter categories"
            className="h-8 w-full rounded-lg border bg-background pl-8 pr-2 text-[13px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded(allOpen ? new Set() : new Set(items.filter((n) => n.childCount > 0).map((n) => n.id)))}
          title={allOpen ? "Collapse all" : "Expand all"}
          aria-label={allOpen ? "Collapse all" : "Expand all"}
          className="grid size-8 shrink-0 place-items-center rounded-lg border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
        </button>
      </div>

      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain" role="tree">
        {items.map((n) => {
          const open = matches ? true : expanded.has(n.id);
          const selected = props.mode === "link" && props.selectedId === n.id;
          return (
            <li key={n.id} hidden={!isVisible(n)} role="treeitem" aria-expanded={n.childCount ? open : undefined} aria-selected={selected}>
              <div
                className={cn(
                  "flex items-center gap-1 rounded-md pr-2 text-[13px] transition-colors",
                  selected ? "bg-accent font-medium text-foreground" : "hover:bg-accent/50",
                )}
                style={{ paddingLeft: `${n.depth * 14 + 2}px` }}
              >
                {n.childCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggle(n.id)}
                    disabled={!!matches}
                    aria-label={open ? `Collapse ${n.name}` : `Expand ${n.name}`}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                  </button>
                ) : (
                  <span className="size-6 shrink-0" />
                )}
                {props.mode === "link" ? (
                  <Link href={`${props.hrefBase}?id=${n.id}`} scroll={false} className="min-w-0 flex-1 truncate py-1.5" title={n.name}>
                    {n.name}
                  </Link>
                ) : (
                  <label htmlFor={inputId(n.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5">
                    <input
                      id={inputId(n.id)}
                      type="checkbox"
                      name={props.name}
                      value={n.id}
                      defaultChecked={props.defaultSelected.includes(n.id)}
                      onChange={(e) => {
                        const on = e.currentTarget.checked;
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(n.id);
                          else next.delete(n.id);
                          return next;
                        });
                      }}
                      className="size-3.5 shrink-0 accent-foreground"
                    />
                    <span className="truncate" title={n.name}>{n.name}</span>
                  </label>
                )}
                {n.total > 0 && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{n.total}</span>}
              </div>
            </li>
          );
        })}
        {matches?.size === 0 && <li className="px-2 py-6 text-center text-xs text-muted-foreground">No category matches “{query}”.</li>}
      </ul>
    </div>
  );
}

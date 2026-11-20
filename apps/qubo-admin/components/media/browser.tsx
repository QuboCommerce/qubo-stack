"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, FileText, LayoutGrid, LayoutTemplate, Loader2, Newspaper, Package, Palette, Search, Shapes, Share2, Tag, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { formatBytes } from "@qubo/storage";
import type { MediaItem, MediaLens, MediaScope } from "@qubo/storage/media";
import { cn } from "@qubo/shared/utils";
import { deleteManyMediaAction, listMediaAction, mediaFacetsAction, shareMediaAction, tagMediaAction, type MediaFacets } from "@/app/media-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Details, TagChip, TagInput } from "./details";
import { ProductCards } from "./product-cards";
import { fileIcon, Segments, Thumb } from "./thumb";

type Kind = MediaItem["kind"];

const SCOPES: MediaScope[] = ["here", "site", "shared", "all"];

const KINDS: { value: Kind | undefined; key: "all" | "image" | "video" }[] = [
  { value: undefined, key: "all" },
  { value: "image", key: "image" },
  { value: "video", key: "video" },
];

export const LENS_ICONS: Record<MediaLens, LucideIcon> = {
  all: LayoutGrid,
  scratch: Shapes,
  products: Package,
  pages: LayoutTemplate,
  design: Palette,
  blog: Newspaper,
  documents: FileText,
};

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.mp4,.webm,.pdf,.txt,.md,.csv,.json";
const ACCEPT_BY_KIND: Record<Kind, string> = { image: ".jpg,.jpeg,.png,.gif,.webp,.avif,.svg", video: ".mp4,.webm", document: ".pdf,.txt,.md,.csv,.json" };
/** Lenses an upload can't land in (they come from links), so a fresh upload shows up in Scratch. */
const LINKED_LENSES = new Set<MediaLens>(["products", "pages", "design", "blog"]);

type Pending = { id: string; name: string };

export type QuickPickOptions = {
  /** Site slug; the library is the site's organisation. */
  site: string;
  /** Current site id, to tell "this site" from "another site" in the detail pane. */
  siteId: string;
  /** Restrict to one kind (e.g. images for an image field). */
  kind?: Kind;
  multiple?: boolean;
  /** Lens of the thing being edited; the picker opens on it. */
  lens?: MediaLens;
};

/**
 * The media library: one pool per organisation seen through lenses. A browser
 * on `/media`, a picker inside QuickPick. Upload by button, drag and drop or
 * paste; everything lands in the pool.
 */
export function MediaBrowser({
  site,
  siteId,
  kind: fixedKind,
  multiple = false,
  lens: contextLens,
  onPick,
  onCancel,
  className,
}: QuickPickOptions & { onPick?: (items: MediaItem[]) => void; onCancel?: () => void; className?: string }) {
  const t = useTranslations("media.browser");
  const picking = Boolean(onPick);
  const [facets, setFacets] = useState<MediaFacets | null>(null);
  const [lens, setLens] = useState<MediaLens>(picking && contextLens ? contextLens : "all");
  const [scope, setScope] = useState<MediaScope>("here");
  const [kind, setKind] = useState<Kind | undefined>(fixedKind);
  const [tag, setTag] = useState<string | undefined>();
  const [missing, setMissing] = useState(false);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const fellBack = useRef(false);

  const cards = !picking && lens === "products";
  const list = lens === "documents" || fixedKind === "document";

  const loadFacets = useCallback(() => void mediaFacetsAction({ site }).then(setFacets), [site]);
  useEffect(loadFacets, [loadFacets]);

  const tabs = useMemo(() => {
    const available = facets?.lenses ?? ["all", "scratch"];
    const wanted: MediaLens[] = picking
      ? [...(contextLens && contextLens !== "all" && contextLens !== "scratch" ? [contextLens] : []), "all", "scratch", ...(!fixedKind || fixedKind === "document" ? (["documents"] as const) : [])]
      : [...available];
    return wanted.filter((l) => l === "all" || l === "scratch" || available.includes(l));
  }, [facets, picking, contextLens, fixedKind]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (append: boolean, before?: string) => {
      const n = ++request.current;
      setLoading(true);
      try {
        const page = await listMediaAction({ site, scope, lens, tag, q: query || undefined, kind: lens === "documents" ? undefined : kind, before });
        if (n !== request.current) return;
        // A picker that opens on the editing context falls back to everything when that lens is empty.
        if (picking && !append && !fellBack.current && lens === contextLens && lens !== "all" && !page.items.length && !query && !tag) {
          fellBack.current = true;
          setLens("all");
          return;
        }
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setMore(page.more);
      } finally {
        if (n === request.current) setLoading(false);
      }
    },
    [site, scope, lens, tag, query, kind, picking, contextLens],
  );

  useEffect(() => {
    if (cards) return;
    void load(false);
  }, [load, cards]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const batch = files.map((f) => ({ id: crypto.randomUUID(), name: f.name }));
      setPending((p) => [...batch, ...p]);
      setErrors([]);
      setNotes([]);
      const body = new FormData();
      body.set("site", site);
      body.set("scope", scope === "shared" ? "shared" : "site");
      for (const f of files) body.append("files", f);
      try {
        const res = await fetch("/api/media-library", { method: "POST", body });
        const json = (await res.json().catch(() => null)) as { items?: MediaItem[]; errors?: string[]; notes?: string[]; error?: string } | null;
        if (!json) throw new Error(t("uploadFailed", { status: res.status }));
        let added = json.items ?? [];
        const notes = json.notes ?? [];
        // Uploading while a tag is selected files the uploads under it.
        if (added.length && tag && !picking) {
          const tagged = await tagMediaAction({ site, ids: added.map((a) => a.id), add: [tag] });
          added = added.map((a) => tagged.find((t) => t.id === a.id) ?? a);
          loadFacets();
        }
        setErrors([...(json.errors ?? []), ...(json.error ? [json.error] : [])]);
        if (!picking && LINKED_LENSES.has(lens) && added.length) {
          setNotes([...notes, tag ? t("uploadedToTag", { tag }) : t("uploadedToScratch")]);
          setLens(tag ? "all" : "scratch");
        } else {
          setNotes(notes);
          setItems((prev) => [...added, ...prev.filter((p) => !added.some((a) => a.id === p.id))]);
        }
        if (added.length) {
          setFocus(added[0]!.id);
          if (picking) setSelected((s) => (multiple ? [...new Set([...s, ...added.map((a) => a.id)])] : [added[0]!.id]));
        }
      } catch (e) {
        setErrors([e instanceof Error ? e.message : t("uploadFailedGeneric")]);
      } finally {
        setPending((p) => p.filter((x) => !batch.some((b) => b.id === x.id)));
      }
    },
    [site, scope, picking, multiple, tag, lens, loadFacets, t],
  );

  // Paste images from the clipboard anywhere in the browser.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!root.current?.isConnected) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        void upload(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  const select = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : multiple || !picking ? [...s, id] : [id]));
  const open = (item: MediaItem) => {
    setFocus(item.id);
    if (picking) select(item.id);
  };

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const focused = focus ? (byId.get(focus) ?? null) : null;
  const replace = (next: MediaItem[]) => setItems((prev) => prev.map((i) => next.find((n) => n.id === i.id) ?? i));
  const switchLens = (l: MediaLens) => {
    setLens(l);
    setSelected((s) => (picking ? s : []));
    setFocus(null);
  };

  const confirm = () => {
    const picked = selected.flatMap((id) => byId.get(id) ?? []);
    if (picked.length) onPick?.(picked);
  };

  const accept = fixedKind ? ACCEPT_BY_KIND[fixedKind] : lens === "documents" ? ACCEPT_BY_KIND.document : ACCEPT;
  const tagNames = facets?.tags.map((t) => t.tag) ?? [];

  return (
    <div
      ref={root}
      className={cn("relative flex min-h-0 flex-col", className)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload([...e.dataTransfer.files]);
      }}
    >
      <div className="flex gap-1 overflow-x-auto border-b px-3 pt-2" role="tablist" aria-label={t("lensesLabel")}>
        {tabs.map((l) => {
          const Icon = LENS_ICONS[l];
          const label = picking && l === "all" ? t("recent") : t(`lenses.${l}.label`);
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lens === l}
              title={t(`lenses.${l}.hint`)}
              onClick={() => switchLens(l)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1 pb-2 text-sm whitespace-nowrap",
                lens === l ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={cards ? t("searchProductsPlaceholder") : t("searchFilesPlaceholder")}
            className="h-8 pl-8"
            aria-label={cards ? t("searchProducts") : t("searchFiles")}
          />
        </div>
        {cards ? (
          <Segments
            label={t("photos")}
            value={missing ? "missing" : "all"}
            onChange={(v) => setMissing(v === "missing")}
            options={[
              { value: "all", label: t("allProducts") },
              { value: "missing", label: t("withoutPhotos"), title: t("withoutPhotosHint") },
            ]}
          />
        ) : (
          <>
            <Segments label={t("sites")} value={scope} onChange={setScope} options={SCOPES.map((s) => ({ value: s, label: t(`scopes.${s}.label`), title: t(`scopes.${s}.hint`) }))} />
            {!fixedKind && lens !== "documents" && <Segments label={t("kind")} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.value, label: t(`kinds.${k.key}`) }))} />}
          </>
        )}
        <Button type="button" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" /> {t("upload")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          data-testid="media-file-input"
          accept={accept}
          onChange={(e) => {
            void upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {!cards && tagNames.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b px-3 py-2" aria-label={t("tags")}>
          <Tag className="size-3.5 shrink-0 text-muted-foreground" />
          {facets!.tags.map((t) => (
            <button
              key={t.tag}
              type="button"
              aria-pressed={tag === t.tag}
              onClick={() => setTag(tag === t.tag ? undefined : t.tag)}
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap",
                tag === t.tag ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.tag} <span className="opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {!picking && selected.length > 0 && !cards && (
        <BulkBar
          site={site}
          ids={selected}
          tagSuggestions={tagNames}
          onChanged={(next) => {
            replace(next);
            loadFacets();
          }}
          onDeleted={(ids, error) => {
            setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
            setSelected((s) => s.filter((x) => !ids.includes(x)));
            if (focus && ids.includes(focus)) setFocus(null);
            if (error) setErrors([error]);
          }}
          onClear={() => setSelected([])}
        />
      )}

      {(errors.length > 0 || notes.length > 0) && (
        <div className={cn("flex items-start gap-2 border-b px-3 py-2 text-sm", errors.length ? "bg-destructive/5 text-destructive" : "bg-muted/40 text-muted-foreground")} role={errors.length ? "alert" : "status"}>
          <ul className="flex-1 space-y-0.5">
            {[...errors, ...notes].map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setErrors([]);
              setNotes([]);
            }}
            aria-label={t("dismiss")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {cards ? (
            <ProductCards site={site} siteId={siteId} query={query} missing={missing} />
          ) : !loading && !items.length && !pending.length ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="grid h-full min-h-60 w-full place-items-center rounded-lg border-2 border-dashed text-center text-sm text-muted-foreground hover:bg-accent/40"
            >
              <span>
                <Upload className="mx-auto mb-2 size-6" />
                {query || tag ? t("noMatch") : t(`lenses.${lens}.empty`)}
                <span className="mt-1 block text-xs">{t("limits")}</span>
              </span>
            </button>
          ) : list ? (
            <ul className="divide-y rounded-lg border" aria-label={t("files")}>
              {pending.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {p.name}
                </li>
              ))}
              {items.map((item) => (
                <FileRow
                  key={item.id}
                  item={item}
                  focused={focus === item.id}
                  selected={selected.includes(item.id)}
                  picking={picking}
                  onOpen={() => open(item)}
                  onPick={() => picking && onPick?.([item])}
                  onSelect={() => select(item.id)}
                />
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5" aria-label={t("files")}>
              {pending.map((p) => (
                <li key={p.id} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-2 text-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <span className="line-clamp-2 text-xs break-all text-muted-foreground">{p.name}</span>
                </li>
              ))}
              {items.map((item) => {
                const isSelected = selected.includes(item.id);
                return (
                  <li key={item.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => open(item)}
                      onDoubleClick={() => picking && onPick?.([item])}
                      aria-pressed={picking ? isSelected : undefined}
                      title={item.filename}
                      className={cn(
                        "relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        focus === item.id && "ring-2 ring-ring/40",
                        isSelected && "ring-2 ring-primary",
                      )}
                    >
                      <Thumb item={item} />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/60 to-transparent px-2 pt-4 pb-1 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {item.filename}
                      </span>
                      {item.siteId === null && scope !== "shared" && (
                        <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1 text-[10px] font-medium">{t("shared")}</span>
                      )}
                    </button>
                    <SelectDot
                      selected={isSelected}
                      label={t("select", { name: item.filename })}
                      onClick={() => select(item.id)}
                      className={cn("absolute top-1.5 right-1.5", !isSelected && !(selected.length && !picking) && "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100")}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {!cards && loading && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-muted-foreground" />}
          {!cards && more && !loading && (
            <div className="mt-3 text-center">
              <Button type="button" variant="outline" size="sm" onClick={() => void load(true, items.at(-1)?.createdAt)}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </div>

        {focused && !cards && (
          <Details
            key={focused.id}
            site={site}
            siteId={siteId}
            item={focused}
            tagSuggestions={tagNames}
            onClose={() => setFocus(null)}
            onChange={(next) => {
              if (next.tags.join() !== focused.tags.join()) loadFacets();
              replace([next]);
            }}
            onDelete={(id) => {
              setItems((prev) => prev.filter((i) => i.id !== id));
              setSelected((s) => s.filter((x) => x !== id));
              setFocus(null);
            }}
          />
        )}
      </div>

      {picking && (
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <span className="text-sm text-muted-foreground">{selected.length ? t("selectedCount", { count: selected.length }) : t("pickHint")}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button type="button" size="sm" disabled={!selected.length} onClick={confirm}>
              {t("insert")}
            </Button>
          </div>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-primary/5 text-sm font-medium text-primary">
          {t("dropToUpload")}
        </div>
      )}
    </div>
  );
}

function SelectDot({ selected, label, onClick, className }: { selected: boolean; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "grid size-5 place-items-center rounded-full border bg-background/90 transition-opacity",
        selected && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      {selected && <Check className="size-3" />}
    </button>
  );
}

function FileRow({
  item,
  focused,
  selected,
  picking,
  onOpen,
  onPick,
  onSelect,
}: {
  item: MediaItem;
  focused: boolean;
  selected: boolean;
  picking: boolean;
  onOpen: () => void;
  onPick: () => void;
  onSelect: () => void;
}) {
  const t = useTranslations("media.browser");
  const format = useFormatter();
  const Icon = item.kind === "image" ? null : fileIcon(item);
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2", focused && "bg-accent/40", selected && "bg-primary/5")}>
      <SelectDot selected={selected} label={t("select", { name: item.filename })} onClick={onSelect} />
      <button type="button" onClick={onOpen} onDoubleClick={onPick} aria-pressed={picking ? selected : undefined} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded border bg-muted/40 text-muted-foreground">
          {Icon ? <Icon className="size-4" /> : <Thumb item={item} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.filename}</span>
          <span className="block text-xs text-muted-foreground">
            {item.mimeType.split(";")[0]} · {formatBytes(item.size)} · {format.dateTime(new Date(item.createdAt), { dateStyle: "short" })}
          </span>
        </span>
        <span className="hidden flex-wrap justify-end gap-1 sm:flex">
          {item.tags.slice(0, 3).map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </span>
      </button>
    </li>
  );
}

function BulkBar({
  site,
  ids,
  tagSuggestions,
  onChanged,
  onDeleted,
  onClear,
}: {
  site: string;
  ids: string[];
  tagSuggestions: string[];
  onChanged: (items: MediaItem[]) => void;
  onDeleted: (ids: string[], error?: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations("media.bulk");
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-2 text-sm" role="toolbar" aria-label={t("label")}>
      <span className="font-medium">{t("selected", { count: ids.length })}</span>
      <div className="w-48">
        <TagInput suggestions={tagSuggestions} placeholder={t("tagPlaceholder")} onAdd={(t) => start(async () => onChanged(await tagMediaAction({ site, ids, add: [t] })))} />
      </div>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => start(async () => onChanged(await shareMediaAction({ site, ids, shared: true })))}>
        <Share2 className="size-4" /> {t("share")}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => start(async () => onChanged(await shareMediaAction({ site, ids, shared: false })))}>
        {t("keep")}
      </Button>
      {confirming ? (
        <span className="flex items-center gap-1.5">
          <span className="text-xs">{t("confirmDelete", { count: ids.length })}</span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await deleteManyMediaAction({ site, ids });
                onDeleted(res.deleted, res.error);
                setConfirming(false);
              })
            }
          >
            {t("delete")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
            {t("keepFiles")}
          </Button>
        </span>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" /> {t("delete")}
        </Button>
      )}
      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <button type="button" onClick={onClear} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
        {t("clear")}
      </button>
    </div>
  );
}

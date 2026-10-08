"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Copy, FileText, Film, ImageIcon, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { formatBytes } from "@qubo/storage";
import type { MediaItem, MediaScope } from "@qubo/storage/media";
import { cn } from "@qubo/shared/utils";
import { deleteMediaAction, listMediaAction, mediaUsageAction, updateMediaAction, type MediaUsage } from "@/app/media-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Kind = MediaItem["kind"];

const SCOPES: { value: MediaScope; label: string; hint: string }[] = [
  { value: "here", label: "Available here", hint: "This site's files and the shared ones" },
  { value: "site", label: "This site", hint: "Uploaded on this site only" },
  { value: "shared", label: "Shared", hint: "Usable by every site of the organisation" },
  { value: "all", label: "All sites", hint: "Everything in the organisation" },
];

const KINDS: { value: Kind | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "document", label: "Documents" },
];

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.mp4,.webm,.pdf";
const ACCEPT_IMAGES = ".jpg,.jpeg,.png,.gif,.webp,.avif,.svg";

type Pending = { id: string; name: string };

export type QuickPickOptions = {
  /** Site slug; the library is the site's organisation. */
  site: string;
  /** Current site id, to tell "this site" from "another site" in the detail pane. */
  siteId: string;
  /** Restrict to one kind (e.g. images for an image field). */
  kind?: Kind;
  multiple?: boolean;
};

/**
 * QuickPick: the media library as a browser (`/media`) or a picker (dialog).
 * Upload by button, drag and drop or paste; everything lands in the library.
 */
export function MediaBrowser({
  site,
  siteId,
  kind: fixedKind,
  multiple = false,
  onPick,
  onCancel,
  className,
}: QuickPickOptions & { onPick?: (items: MediaItem[]) => void; onCancel?: () => void; className?: string }) {
  const picking = Boolean(onPick);
  const [scope, setScope] = useState<MediaScope>("here");
  const [kind, setKind] = useState<Kind | undefined>(fixedKind);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const request = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (append: boolean, before?: string) => {
      const n = ++request.current;
      setLoading(true);
      try {
        const page = await listMediaAction({ site, scope, q: query || undefined, kind, before });
        if (n !== request.current) return;
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setMore(page.more);
      } finally {
        if (n === request.current) setLoading(false);
      }
    },
    [site, scope, query, kind],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const batch = files.map((f) => ({ id: crypto.randomUUID(), name: f.name }));
      setPending((p) => [...batch, ...p]);
      setErrors([]);
      const body = new FormData();
      body.set("site", site);
      body.set("scope", scope === "shared" ? "shared" : "site");
      for (const f of files) body.append("files", f);
      try {
        const res = await fetch("/api/media-library", { method: "POST", body });
        const json = (await res.json().catch(() => null)) as { items?: MediaItem[]; errors?: string[]; error?: string } | null;
        if (!json) throw new Error(`Upload failed (${res.status}).`);
        const added = json.items ?? [];
        setItems((prev) => [...added, ...prev]);
        setErrors([...(json.errors ?? []), ...(json.error ? [json.error] : [])]);
        if (added.length) {
          setFocus(added[0]!.id);
          if (picking) setSelected((s) => (multiple ? [...s, ...added.map((a) => a.id)] : [added[0]!.id]));
        }
      } catch (e) {
        setErrors([e instanceof Error ? e.message : "Upload failed."]);
      } finally {
        setPending((p) => p.filter((x) => !batch.some((b) => b.id === x.id)));
      }
    },
    [site, scope, picking, multiple],
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

  const toggle = (item: MediaItem) => {
    setFocus(item.id);
    if (!picking) return;
    setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : multiple ? [...s, item.id] : [item.id]));
  };

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const focused = focus ? (byId.get(focus) ?? null) : null;

  const confirm = () => {
    const picked = selected.flatMap((id) => byId.get(id) ?? []);
    if (picked.length) onPick?.(picked);
  };

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
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" className="h-8 pl-8" aria-label="Search files" />
        </div>
        <Segments value={scope} onChange={setScope} options={SCOPES.map((s) => ({ value: s.value, label: s.label, title: s.hint }))} />
        {!fixedKind && <Segments value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />}
        <Button type="button" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" /> Upload
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          data-testid="media-file-input"
          accept={fixedKind === "image" ? ACCEPT_IMAGES : ACCEPT}
          onChange={(e) => {
            void upload([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="flex items-start gap-2 border-b bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <ul className="flex-1 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setErrors([])} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!loading && !items.length && !pending.length ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="grid h-full min-h-60 w-full place-items-center rounded-lg border-2 border-dashed text-center text-sm text-muted-foreground hover:bg-accent/40"
            >
              <span>
                <Upload className="mx-auto mb-2 size-6" />
                {query ? "Nothing matches that search." : "No files yet. Drop, paste or click to upload."}
                <span className="mt-1 block text-xs">Images up to 20 MB (JPG, PNG, WebP, AVIF, GIF, SVG), MP4/WebM up to 100 MB, PDF.</span>
              </span>
            </button>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
              {pending.map((p) => (
                <li key={p.id} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 p-2 text-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <span className="line-clamp-2 text-xs break-all text-muted-foreground">{p.name}</span>
                </li>
              ))}
              {items.map((item) => {
                const isSelected = selected.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      onDoubleClick={() => picking && onPick?.([item])}
                      aria-pressed={picking ? isSelected : undefined}
                      title={item.filename}
                      className={cn(
                        "group relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        focus === item.id && "ring-2 ring-ring/40",
                        isSelected && "ring-2 ring-primary",
                      )}
                    >
                      <Thumb item={item} />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/60 to-transparent px-2 pt-4 pb-1 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {item.filename}
                      </span>
                      {picking && (
                        <span
                          className={cn(
                            "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border bg-background/90",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "opacity-0 group-hover:opacity-100",
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                        </span>
                      )}
                      {item.siteId === null && scope !== "shared" && (
                        <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1 text-[10px] font-medium">Shared</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {loading && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-muted-foreground" />}
          {more && !loading && (
            <div className="mt-3 text-center">
              <Button type="button" variant="outline" size="sm" onClick={() => void load(true, items.at(-1)?.createdAt)}>
                Load more
              </Button>
            </div>
          )}
        </div>

        {focused && (
          <Details
            key={focused.id}
            site={site}
            siteId={siteId}
            item={focused}
            onClose={() => setFocus(null)}
            onChange={(next) => setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)))}
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
          <span className="text-sm text-muted-foreground">{selected.length ? `${selected.length} selected` : "Click to select, double-click to insert"}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!selected.length} onClick={confirm}>
              Insert
            </Button>
          </div>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-primary/5 text-sm font-medium text-primary">
          Drop to upload
        </div>
      )}
    </div>
  );
}

function Segments<T extends string | undefined>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; title?: string }[] }) {
  return (
    <div className="flex rounded-md border p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("rounded px-2 py-1 text-xs whitespace-nowrap", value === o.value ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Thumb({ item, className }: { item: Pick<MediaItem, "kind" | "url" | "alt" | "filename">; className?: string }) {
  if (item.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt={item.alt || item.filename} loading="lazy" className={cn("size-full object-cover", className)} />;
  }
  const Icon = item.kind === "video" ? Film : FileText;
  return (
    <span className={cn("flex size-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground", className)}>
      <Icon className="size-6" />
      <span className="line-clamp-2 text-center text-[11px] break-all">{item.filename}</span>
    </span>
  );
}

function Details({
  site,
  siteId,
  item,
  onClose,
  onChange,
  onDelete,
}: {
  site: string;
  siteId: string;
  item: MediaItem;
  onClose: () => void;
  onChange: (item: MediaItem) => void;
  onDelete: (id: string) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [usage, setUsage] = useState<MediaUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const otherSite = item.siteId !== null && item.siteId !== siteId;

  useEffect(() => {
    let live = true;
    void mediaUsageAction({ site, id: item.id }).then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, [site, item.id]);

  const save = (patch: { alt?: string; shared?: boolean }) =>
    start(async () => {
      const res = await updateMediaAction({ site, id: item.id, ...patch });
      if ("error" in res) setError(res.error);
      else onChange(res);
    });

  const uses = usage ? usage.documents.length + usage.products.length : 0;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3 text-sm" aria-label="File details">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium break-all">{item.filename}</p>
        <button type="button" onClick={onClose} aria-label="Close details" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="overflow-hidden rounded-md border bg-muted/40">
        {item.kind === "video" ? (
          <video src={item.url} controls preload="metadata" className="max-h-48 w-full" />
        ) : item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.alt} className="max-h-48 w-full object-contain" />
        ) : (
          <a href={item.url} target="_blank" rel="noreferrer" className="flex h-24 items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
            <FileText className="size-5" /> Open
          </a>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Type</dt>
        <dd>{item.mimeType}</dd>
        <dt className="text-muted-foreground">Size</dt>
        <dd>{formatBytes(item.size)}</dd>
        {item.width && item.height ? (
          <>
            <dt className="text-muted-foreground">Dimensions</dt>
            <dd>
              {item.width} × {item.height}
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Added</dt>
        <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
      </dl>

      {item.kind !== "document" && (
        <label className="grid gap-1">
          <span className="text-xs font-medium">Alt text</span>
          <Textarea
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => alt !== item.alt && save({ alt })}
            rows={2}
            maxLength={300}
            placeholder="Describe the image for screen readers and search engines"
            className="text-sm"
          />
        </label>
      )}

      <label className="flex items-center justify-between gap-2">
        <span className="grid">
          <span className="text-xs font-medium">Shared with all sites</span>
          <span className="text-xs text-muted-foreground">{otherSite ? "Uploaded on another site" : "Every site in the organisation can use it"}</span>
        </span>
        <Switch checked={item.siteId === null} disabled={busy || otherSite} onCheckedChange={(v) => save({ shared: v })} />
      </label>

      <div className="grid gap-1">
        <span className="text-xs font-medium">Used in</span>
        {!usage ? (
          <span className="text-xs text-muted-foreground">Checking…</span>
        ) : uses === 0 ? (
          <span className="text-xs text-muted-foreground">Not used yet</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {usage.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-1.5">
                <ImageIcon className="size-3 text-muted-foreground" /> {d.title ?? "Untitled page"}
              </li>
            ))}
            {usage.products.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5">
                <ImageIcon className="size-3 text-muted-foreground" /> {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(new URL(item.url, location.origin).toString());
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy link"}
      </Button>

      {confirming ? (
        <div className="grid gap-2 rounded-md border border-destructive/40 p-2 text-xs">
          <p>{uses ? `Used in ${uses} place${uses === 1 ? "" : "s"}. Those will lose this file.` : "Delete this file for good?"}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const res = await deleteMediaAction({ site, id: item.id });
                  if ("error" in res) setError(res.error);
                  else onDelete(item.id);
                })
              }
            >
              Delete
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </aside>
  );
}

/** The picker in a dialog. */
export function QuickPick({
  open,
  onOpenChange,
  onPick,
  title = "Media",
  ...options
}: QuickPickOptions & { open: boolean; onOpenChange: (open: boolean) => void; onPick: (items: MediaItem[]) => void; title?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[min(88vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,72rem)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-xs">Pick from the library, or drop, paste and upload new files.</DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {open && (
          <MediaBrowser
            {...options}
            className="min-h-0 flex-1"
            onCancel={() => onOpenChange(false)}
            onPick={(items) => {
              onPick(items);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

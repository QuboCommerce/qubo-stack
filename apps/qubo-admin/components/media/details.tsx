"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { Check, Copy, FileText, LayoutTemplate, Package, Plus, Trash2, X } from "lucide-react";
import { formatBytes } from "@qubo/storage";
import type { MediaItem } from "@qubo/storage/media";
import { deleteMediaAction, mediaUsageAction, tagMediaAction, updateMediaAction, type MediaUsage } from "@/app/media-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/** Text field that adds a tag on Enter, with the organisation's tags as suggestions. */
export function TagInput({ suggestions, onAdd, placeholder = "Add a tag", autoFocus }: { suggestions: string[]; onAdd: (tag: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const list = useId();
  const add = () => {
    const tag = value.trim();
    if (tag) onAdd(tag);
    setValue("");
  };
  return (
    <div className="flex gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        list={list}
        maxLength={40}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="h-7 text-xs"
      />
      <datalist id={list}>
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Button type="button" size="icon" variant="outline" className="size-7 shrink-0" onClick={add} aria-label="Add tag">
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border bg-muted/40 py-0.5 pr-1 pl-2 text-[11px]">
      {tag}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove tag ${tag}`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Side pane for one file: preview, rename, alt text, tags, sharing, where it's used, delete. */
export function Details({
  site,
  siteId,
  item,
  tagSuggestions,
  onClose,
  onChange,
  onDelete,
}: {
  site: string;
  siteId: string;
  item: MediaItem;
  tagSuggestions: string[];
  onClose: () => void;
  onChange: (item: MediaItem) => void;
  onDelete: (id: string) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [filename, setFilename] = useState(item.filename);
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

  const save = (patch: { alt?: string; filename?: string; shared?: boolean }) =>
    start(async () => {
      const res = await updateMediaAction({ site, id: item.id, ...patch });
      if ("error" in res) setError(res.error);
      else {
        setError(null);
        onChange(res);
      }
    });

  const retag = (change: { add?: string[]; remove?: string[] }) =>
    start(async () => {
      const [next] = await tagMediaAction({ site, ids: [item.id], ...change });
      if (next) onChange(next);
    });

  const uses = usage ? usage.documents.length + usage.products.length : 0;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3 text-sm" aria-label="File details">
      <div className="flex items-start justify-between gap-2">
        <Input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          onBlur={() => filename.trim() && filename !== item.filename && save({ filename })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          maxLength={200}
          aria-label="File name"
          className="h-7 min-w-0 px-1.5 font-medium"
        />
        <button type="button" onClick={onClose} aria-label="Close details" className="mt-1 text-muted-foreground hover:text-foreground">
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
        <dd>{item.mimeType.split(";")[0]}</dd>
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

      <div className="grid gap-1.5">
        <span className="text-xs font-medium">Tags</span>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <TagChip key={t} tag={t} onRemove={() => retag({ remove: [t] })} />
            ))}
          </div>
        )}
        <TagInput suggestions={tagSuggestions.filter((t) => !item.tags.includes(t))} onAdd={(t) => retag({ add: [t] })} />
      </div>

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
          <span className="text-xs text-muted-foreground">Not used yet{item.tags.length ? "" : ", so it sits in Scratch"}</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {usage.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-1.5">
                <LayoutTemplate className="size-3 text-muted-foreground" /> {d.title ?? "Untitled page"}
              </li>
            ))}
            {usage.products.map((p) => (
              <li key={p.id}>
                <Link href={`/${site}/products/${p.id}`} className="flex items-center gap-1.5 hover:underline">
                  <Package className="size-3 text-muted-foreground" /> {p.name}
                </Link>
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

"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Copy, FileText, LayoutTemplate, Package, Plus, Trash2, X } from "lucide-react";
import { formatBytes } from "@qubo/storage";
import type { MediaItem } from "@qubo/storage/media";
import { deleteMediaAction, mediaUsageAction, tagMediaAction, updateMediaAction, type MediaUsage } from "@/app/media-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/** Text field that adds a tag on Enter, with the organisation's tags as suggestions. */
export function TagInput({ suggestions, onAdd, placeholder, autoFocus }: { suggestions: string[]; onAdd: (tag: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const t = useTranslations("media.tags");
  const label = placeholder ?? t("add");
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
        placeholder={label}
        autoFocus={autoFocus}
        aria-label={label}
        className="h-7 text-xs"
      />
      <datalist id={list}>
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Button type="button" size="icon" variant="outline" className="size-7 shrink-0" onClick={add} aria-label={t("addButton")}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const t = useTranslations("media.tags");
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border bg-muted/40 py-0.5 pr-1 pl-2 text-[11px]">
      {tag}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t("remove", { tag })} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
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
  const t = useTranslations("media.details");
  const format = useFormatter();
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
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l p-3 text-sm" aria-label={t("label")}>
      <div className="flex items-start justify-between gap-2">
        <Input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          onBlur={() => filename.trim() && filename !== item.filename && save({ filename })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          maxLength={200}
          aria-label={t("fileName")}
          className="h-7 min-w-0 px-1.5 font-medium"
        />
        <button type="button" onClick={onClose} aria-label={t("close")} className="mt-1 text-muted-foreground hover:text-foreground">
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
            <FileText className="size-5" /> {t("open")}
          </a>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t("type")}</dt>
        <dd>{item.mimeType.split(";")[0]}</dd>
        <dt className="text-muted-foreground">{t("size")}</dt>
        <dd>{formatBytes(item.size)}</dd>
        {item.width && item.height ? (
          <>
            <dt className="text-muted-foreground">{t("dimensions")}</dt>
            <dd>
              {item.width} × {item.height}
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{t("added")}</dt>
        <dd>{format.dateTime(new Date(item.createdAt), { dateStyle: "short" })}</dd>
      </dl>

      {item.kind !== "document" && (
        <label className="grid gap-1">
          <span className="text-xs font-medium">{t("altText")}</span>
          <Textarea
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => alt !== item.alt && save({ alt })}
            rows={2}
            maxLength={300}
            placeholder={t("altPlaceholder")}
            className="text-sm"
          />
        </label>
      )}

      <div className="grid gap-1.5">
        <span className="text-xs font-medium">{t("tags")}</span>
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
          <span className="text-xs font-medium">{t("sharedTitle")}</span>
          <span className="text-xs text-muted-foreground">{otherSite ? t("sharedOtherSite") : t("sharedHint")}</span>
        </span>
        <Switch checked={item.siteId === null} disabled={busy || otherSite} onCheckedChange={(v) => save({ shared: v })} />
      </label>

      <div className="grid gap-1">
        <span className="text-xs font-medium">{t("usedIn")}</span>
        {!usage ? (
          <span className="text-xs text-muted-foreground">{t("checking")}</span>
        ) : uses === 0 ? (
          <span className="text-xs text-muted-foreground">{item.tags.length ? t("notUsed") : t("notUsedScratch")}</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {usage.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-1.5">
                <LayoutTemplate className="size-3 text-muted-foreground" /> {d.title ?? t("untitledPage")}
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
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t("copied") : t("copyLink")}
      </Button>

      {confirming ? (
        <div className="grid gap-2 rounded-md border border-destructive/40 p-2 text-xs">
          <p>{uses ? t("usedConfirm", { count: uses }) : t("deleteConfirm")}</p>
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
              {t("delete")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
              {t("keep")}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" /> {t("delete")}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </aside>
  );
}

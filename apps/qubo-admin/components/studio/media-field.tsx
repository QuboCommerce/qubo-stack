"use client";

import { useState } from "react";
import { FieldLabel, type Field } from "@puckeditor/core";
import type { FieldAdapters, MediaValue } from "@qubo/blocks";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import { QuickPick, Thumb } from "@/components/media/quick-pick";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MediaDefLike = Parameters<NonNullable<FieldAdapters["media"]>>[0];

const kindOfUrl = (url: string) => (/\.(mp4|webm)(\?|$)/i.test(url) ? "video" : /\.pdf(\?|$)/i.test(url) ? "document" : "image");

/** Studio media fields open QuickPick instead of asking for a URL. */
export function mediaFieldAdapter(site: { slug: string; id: string }): NonNullable<FieldAdapters["media"]> {
  return (def: MediaDefLike) =>
    ({
      type: "custom",
      label: def.meta.label,
      render: ({ value, onChange, readOnly, id }) => (
        <MediaField id={id} label={def.meta.label} accept={def.accept} site={site} value={value as MediaValue | null} onChange={onChange} readOnly={readOnly} />
      ),
    }) satisfies Field;
}

function MediaField({
  id,
  label,
  accept,
  site,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  label: string;
  accept: "image" | "video" | "any";
  site: { slug: string; id: string };
  value: MediaValue | null;
  onChange: (v: MediaValue | null) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const url = value?.url;

  return (
    <FieldLabel label={label} el="div" readOnly={readOnly}>
      <div className="grid gap-2">
        {url ? (
          <div className="group relative overflow-hidden rounded-md border bg-muted/40">
            <div className="aspect-video">
              <Thumb item={{ kind: kindOfUrl(url), url, alt: value?.alt ?? "", filename: url.split("/").pop() ?? "" }} className="object-contain" />
            </div>
            {!readOnly && (
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button type="button" size="icon" variant="secondary" className="size-7" onClick={() => setOpen(true)} aria-label="Replace">
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button type="button" size="icon" variant="secondary" className="size-7" onClick={() => onChange(null)} aria-label="Remove">
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setOpen(true)}
            className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-accent/40 disabled:opacity-50"
          >
            <ImagePlus className="size-5" />
            Choose {accept === "video" ? "a video" : accept === "image" ? "an image" : "a file"}
          </button>
        )}
        {url && (
          <Input
            id={id}
            value={value?.alt ?? ""}
            readOnly={readOnly}
            onChange={(e) => onChange({ ...value!, alt: e.target.value })}
            placeholder="Alt text"
            className="h-8 text-xs"
          />
        )}
      </div>
      <QuickPick
        open={open}
        onOpenChange={setOpen}
        site={site.slug}
        siteId={site.id}
        kind={accept === "any" ? undefined : accept}
        title={label}
        onPick={([item]) => {
          if (!item) return;
          onChange({
            assetId: item.id,
            url: item.url,
            alt: value?.alt || item.alt,
            ...(item.width && item.height ? { width: item.width, height: item.height } : {}),
            ...(value?.focal ? { focal: value.focal } : {}),
          });
        }}
      />
    </FieldLabel>
  );
}

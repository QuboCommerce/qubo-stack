"use client";

import type { BrandAsset, Mode, Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { QuickPick } from "@/components/media/quick-pick";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Group } from "./controls";
import type { ThemeUpdate } from "./design-controls";
import { ThemeScope } from "./preview";

type Slot = "logo" | "logoInverse" | "mark" | "favicon" | "ogImage";

const slots: { id: Slot; label: string; hint: string; dark?: boolean; wide?: boolean; square?: boolean }[] = [
  { id: "logo", label: "Logo", hint: "For light backgrounds" },
  { id: "logoInverse", label: "Logo on dark", hint: "Falls back to the logo", dark: true },
  { id: "mark", label: "Mark", hint: "Square symbol for loaders and transitions", square: true },
  { id: "favicon", label: "Favicon", hint: "Browser tab, at least 48 px", square: true },
  { id: "ogImage", label: "Sharing image", hint: "Shown when a link is shared, 1200 × 630", wide: true },
];

export function BrandPage({ theme, update, site, mode }: { theme: Theme; update: ThemeUpdate; site: { slug: string; id: string }; mode: Mode }) {
  const brand = theme.brand;
  const [picking, setPicking] = useState<Slot | null>(null);
  const setBrand = (patch: Partial<Theme["brand"]>, key?: string) => update((t) => ({ ...t, brand: { ...t.brand, ...patch } }), key);
  const label = slots.find((s) => s.id === picking)?.label;

  return (
    <div>
      <Group title="Identity" description="Used by the header, page transitions, the browser tab and link previews.">
        <div className="grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <AssetTile
              key={s.id}
              slot={s}
              value={brand[s.id]}
              theme={theme}
              mode={mode}
              onPick={() => setPicking(s.id)}
              onClear={() => setBrand({ [s.id]: null })}
              onAlt={(alt) => brand[s.id] && setBrand({ [s.id]: { ...brand[s.id]!, alt } }, `alt-${s.id}`)}
            />
          ))}
        </div>
      </Group>

      <Group title="Voice" description="How the brand sounds. Copy suggestions and the AI writer follow this.">
        <div className="space-y-1.5">
          <label htmlFor="brand-tone" className="text-[13px] font-medium">Tone</label>
          <Textarea
            id="brand-tone"
            value={brand.voice.tone}
            onChange={(e) => setBrand({ voice: { ...brand.voice, tone: e.target.value } }, "tone")}
            placeholder="Plain, warm and exact. We fix things; we don't oversell."
            className="min-h-20 text-[13px]"
          />
        </div>
        <AvoidList value={brand.voice.avoid} onChange={(avoid) => setBrand({ voice: { ...brand.voice, avoid } })} />
      </Group>

      <QuickPick
        open={!!picking}
        onOpenChange={(o) => !o && setPicking(null)}
        site={site.slug}
        siteId={site.id}
        kind="image"
        title={label ?? "Brand"}
        onPick={([item]) => {
          if (!item || !picking) return;
          const asset: BrandAsset = {
            assetId: item.id,
            url: item.url,
            alt: item.alt || theme.name,
            ...(item.width && item.height ? { width: item.width, height: item.height } : {}),
          };
          setBrand({ [picking]: asset });
          setPicking(null);
        }}
      />
    </div>
  );
}

function AssetTile({
  slot,
  value,
  theme,
  mode,
  onPick,
  onClear,
  onAlt,
}: {
  slot: (typeof slots)[number];
  value: BrandAsset | null;
  theme: Theme;
  mode: Mode;
  onPick: () => void;
  onClear: () => void;
  onAlt: (alt: string) => void;
}) {
  const fallback = slot.id === "logoInverse" ? theme.brand.logo : null;
  const shown = value?.url ? value : fallback?.url ? fallback : null;
  return (
    <div className={cn("space-y-1.5", slot.wide && "col-span-2")}>
      <ThemeScope theme={theme} mode={slot.dark ? "dark" : mode} className="rounded-lg">
        <div
          className={cn(
            "group relative overflow-hidden rounded-lg ring-1 ring-border",
            slot.wide ? "aspect-[1200/630]" : "aspect-[4/3]",
          )}
          style={{ background: slot.dark ? "oklch(0.2 0.01 260)" : "var(--qb-background)" }}
        >
          {shown?.url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown.url}
                alt={shown.alt}
                className={cn("size-full", slot.wide ? "object-cover" : "object-contain p-4", !value?.url && "opacity-50")}
              />
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button type="button" size="icon" variant="secondary" className="size-7" onClick={onPick} aria-label={`Replace ${slot.label}`}>
                  <RefreshCw className="size-3.5" />
                </Button>
                {value?.url && (
                  <Button type="button" size="icon" variant="secondary" className="size-7" onClick={onClear} aria-label={`Remove ${slot.label}`}>
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onPick}
              className={cn(
                "flex size-full flex-col items-center justify-center gap-1 text-xs transition-colors",
                slot.dark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <ImagePlus className="size-5" />
              Choose
            </button>
          )}
        </div>
      </ThemeScope>
      <div className="px-0.5">
        <p className="text-[12px] font-medium leading-tight">{slot.label}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{value?.url || !fallback?.url ? slot.hint : "Using the logo"}</p>
      </div>
      {value?.url && slot.wide && (
        <Input value={value.alt} onChange={(e) => onAlt(e.target.value)} placeholder="Describe the image" className="h-8 text-xs" aria-label={`${slot.label} alt text`} />
      )}
    </div>
  );
}

function AvoidList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const words = draft.split(",").map((w) => w.trim()).filter(Boolean);
    if (!words.length) return;
    onChange(Array.from(new Set([...value, ...words])));
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor="brand-avoid" className="text-[13px] font-medium">Words to avoid</label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {value.map((w) => (
            <li key={w} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2 text-xs">
              {w}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== w))} className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${w}`}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id="brand-avoid"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="cutting-edge, seamless, unlock"
        className="h-8 text-xs"
      />
    </div>
  );
}

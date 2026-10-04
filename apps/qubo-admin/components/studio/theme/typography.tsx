"use client";

import { fontRoles, type Font, type FontRole, type Mode, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { catalogFont, fontCatalog, ratioLabel, scaleRatios, weightNames } from "@/lib/font-catalog";
import { Field, Group, SliderField, uniqueSlug } from "./controls";
import { ThemeScope } from "./preview";

const roleInfo: Record<FontRole, { label: string; sample: string; hint: string }> = {
  display: { label: "Display", sample: "Big statements", hint: "Hero titles and huge numbers" },
  heading: { label: "Headings", sample: "Section heading", hint: "Section and card titles" },
  body: { label: "Body", sample: "Readable paragraphs that carry the story.", hint: "Paragraphs, lists, forms" },
  accent: { label: "Accent", sample: "Eyebrow · Label", hint: "Eyebrows, labels, buttons (optional)" },
  mono: { label: "Mono", sample: "SKU-2048 · 12.5 kW", hint: "Codes, specs, prices" },
};

const categoryLabel = { sans: "Sans serif", serif: "Serif", display: "Display", mono: "Monospace", handwriting: "Handwriting" } as const;

export function TypographyPage({ theme, update, mode }: { theme: Theme; update: (fn: (t: Theme) => Theme, key?: string) => void; mode: Mode }) {
  const [open, setOpen] = useState<FontRole | null>(null);
  const ts = theme.typeset;

  const setRole = (role: FontRole, patch: Partial<Theme["typeset"]["roles"][FontRole]>, key?: string) =>
    update((t) => ({ ...t, typeset: { ...t.typeset, roles: { ...t.typeset.roles, [role]: { ...t.typeset.roles[role], ...patch } } } }), key);
  const setScale = (patch: Partial<Theme["typeset"]["scale"]>, key?: string) =>
    update((t) => ({ ...t, typeset: { ...t.typeset, scale: { ...t.typeset.scale, ...patch } } }), key);

  const addFont = (family: string) => {
    const existing = ts.fonts.find((f) => f.family.toLowerCase() === family.toLowerCase());
    if (existing) return existing.id;
    const cat = catalogFont(family);
    const font: Font = {
      id: uniqueSlug(family, ts.fonts.map((f) => f.id)),
      family: cat?.family ?? family,
      fallback: cat?.fallback ?? "system-ui, sans-serif",
      source: "google",
      files: [],
      ...(cat?.weights ? { weights: [...cat.weights] } : {}),
    };
    update((t) => ({ ...t, typeset: { ...t.typeset, fonts: [...t.typeset.fonts, font] } }));
    return font.id;
  };

  const usage = (fontId: string) => fontRoles.filter((r) => ts.roles[r].font === fontId);
  const s = ts.scale;
  const steps = [6, 5, 4, 3, 2, 1, 0, -1, -2];
  const px = (base: number, ratio: number, step: number) => Math.round(base * ratio ** step);

  return (
    <div>
      <Group
        title="Fonts"
        description="The families this theme loads. Fewer fonts means faster pages."
        action={<AddFont onPick={addFont} />}
      >
        <ul className="-mx-1 space-y-1">
          {ts.fonts.map((f) => {
            const used = usage(f.id);
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg" style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>
                  Aa
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium" style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>{f.family}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {f.source === "google" ? "Google Fonts" : f.source === "asset" ? "Uploaded" : "System"}
                    {used.length ? ` · ${used.map((r) => roleInfo[r].label).join(", ")}` : " · unused"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  disabled={used.length > 0 || ts.fonts.length <= 1}
                  title={used.length ? "Used by a text style" : "Remove font"}
                  aria-label={`Remove ${f.family}`}
                  onClick={() => update((t) => ({ ...t, typeset: { ...t.typeset, fonts: t.typeset.fonts.filter((x) => x.id !== f.id) } }))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Text styles" description="Blocks pick a style, never a font, so changing one here restyles the whole site.">
        <ul className="-mx-2 space-y-1">
          {fontRoles.map((role) => {
            const r = ts.roles[role];
            const font = ts.fonts.find((f) => f.id === r.font);
            const weights = (font && catalogFont(font.family)?.weights) ?? [100, 200, 300, 400, 500, 600, 700, 800, 900];
            const isOpen = open === role;
            return (
              <li key={role} className={cn("rounded-lg transition-colors", isOpen ? "bg-muted/60 ring-1 ring-border" : "hover:bg-muted/50")}>
                <button type="button" className="flex w-full items-center gap-2 px-2 pt-2 pb-1 text-left" onClick={() => setOpen(isOpen ? null : role)} aria-expanded={isOpen}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      {roleInfo[role].label} · {font?.family ?? "?"} {r.weight}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                <ThemeScope theme={theme} mode={mode} className="mx-2 mb-2 overflow-hidden rounded-md px-2.5 py-2">
                  <p className={`qb-font-${role} truncate`} style={{ fontSize: role === "display" ? 30 : role === "heading" ? 21 : 14, color: role === "heading" || role === "display" ? "var(--qb-heading)" : undefined }}>
                    {roleInfo[role].sample}
                  </p>
                </ThemeScope>
                {isOpen && (
                  <div className="space-y-3.5 px-2 pt-1 pb-3">
                    <p className="text-xs text-muted-foreground">{roleInfo[role].hint}</p>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Field label="Font">
                        <Select value={r.font} onValueChange={(v) => setRole(role, { font: v })}>
                          <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ts.fonts.map((f) => (
                              <SelectItem key={f.id} value={f.id} className="text-xs"><span style={{ fontFamily: `"${f.family}", ${f.fallback}` }}>{f.family}</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Weight">
                        <Select value={String(r.weight)} onValueChange={(v) => setRole(role, { weight: Number(v) })}>
                          <SelectTrigger size="sm" className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from(new Set([...weights, r.weight])).sort((a, b) => a - b).map((w) => (
                              <SelectItem key={w} value={String(w)} className="text-xs">{w} · {weightNames[w] ?? ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <SliderField label="Line height" value={r.lineHeight} min={0.8} max={2.2} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => setRole(role, { lineHeight: v }, `lh:${role}`)} />
                    <SliderField label="Letter spacing" value={r.tracking} min={-0.08} max={0.2} step={0.01} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}em`} onChange={(v) => setRole(role, { tracking: v }, `tr:${role}`)} />
                    <Field label="All caps" inline>
                      <Switch checked={r.uppercase} onCheckedChange={(uppercase) => setRole(role, { uppercase })} aria-label="All caps" />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Size scale" description="Sizes grow smoothly from phone to desktop. Each step is the previous one times the ratio.">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          <SliderField label="Base · phone" value={s.baseMin} min={12} max={22} step={1} format={(v) => `${v}px`} onChange={(v) => setScale({ baseMin: v }, "bmin")} />
          <SliderField label="Base · desktop" value={s.baseMax} min={12} max={24} step={1} format={(v) => `${v}px`} onChange={(v) => setScale({ baseMax: v }, "bmax")} />
          <Field label="Ratio · phone">
            <RatioSelect value={s.ratioMin} onChange={(v) => setScale({ ratioMin: v })} />
          </Field>
          <Field label="Ratio · desktop">
            <RatioSelect value={s.ratioMax} onChange={(v) => setScale({ ratioMax: v })} />
          </Field>
        </div>
        <ThemeScope theme={theme} mode={mode} className="overflow-hidden rounded-lg ring-1 ring-border">
          <ol className="divide-y" style={{ borderColor: "var(--qb-border)" }}>
            {steps.map((step) => {
              const hi = px(s.baseMax, s.ratioMax, step);
              return (
                <li key={step} className="flex items-baseline gap-2 px-2.5 py-1.5" style={{ borderColor: "var(--qb-border)" }}>
                  <span className="w-6 shrink-0 font-mono text-[10px] opacity-60">{step}</span>
                  <span className={cn("min-w-0 flex-1 truncate", step >= 3 ? "qb-font-heading" : "qb-font-body")} style={{ fontSize: Math.min(hi, 40), lineHeight: 1.1 }}>
                    Aa
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-70">
                    {px(s.baseMin, s.ratioMin, step)}→{hi}px
                  </span>
                </li>
              );
            })}
          </ol>
        </ThemeScope>
      </Group>
    </div>
  );
}

function RatioSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const known = scaleRatios.some((r) => Math.abs(r.value - value) < 0.005);
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue>{ratioLabel(value)}</SelectValue></SelectTrigger>
      <SelectContent>
        {!known && <SelectItem value={String(value)} className="text-xs">×{value}</SelectItem>}
        {scaleRatios.map((r) => (
          <SelectItem key={r.value} value={String(r.value)} className="text-xs">
            {r.label} <span className="text-muted-foreground">×{r.value}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddFont({ onPick }: { onPick: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const categories = Array.from(new Set(fontCatalog.map((f) => f.category)));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="-mr-2 -mt-1 h-7 gap-1 px-2 text-xs"><Plus className="size-3.5" /> Add</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search Google Fonts…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-72">
            <CommandEmpty className="p-2">
              {query.trim() ? (
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onPick(query.trim());
                    setOpen(false);
                  }}
                >
                  Use “{query.trim()}” from Google Fonts
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">No fonts found.</span>
              )}
            </CommandEmpty>
            {categories.map((c) => (
              <CommandGroup key={c} heading={categoryLabel[c]}>
                {fontCatalog
                  .filter((f) => f.category === c)
                  .map((f) => (
                    <CommandItem
                      key={f.family}
                      value={f.family}
                      onSelect={() => {
                        onPick(f.family);
                        setOpen(false);
                      }}
                    >
                      {f.family}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

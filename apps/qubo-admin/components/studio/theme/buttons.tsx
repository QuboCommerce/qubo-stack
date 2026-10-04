"use client";

import { buttonEmphases, fontRoles, normalizeRef, radiusSteps, type ButtonStyle, type Mode, type Shadow, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { ChevronDown, Copy, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { weightNames } from "@/lib/font-catalog";
import { Field, Group, SliderField, TokenSelect, uniqueSlug } from "./controls";
import { ThemeScope } from "./preview";

const hoverLabel: Record<ButtonStyle["hover"], string> = { none: "None", darken: "Darken", lift: "Lift", press: "Press", glow: "Glow" };
const emphasisLabel: Record<(typeof buttonEmphases)[number], string> = { primary: "Primary", secondary: "Secondary", outline: "Outline", ghost: "Ghost", link: "Link" };

export function ButtonsPage({ theme, update, mode }: { theme: Theme; update: (fn: (t: Theme) => Theme, key?: string) => void; mode: Mode }) {
  const [open, setOpen] = useState<string | null>(null);
  const [openShadow, setOpenShadow] = useState<string | null>(null);

  const setButton = (id: string, patch: Partial<ButtonStyle>, key?: string) =>
    update((t) => ({ ...t, buttons: t.buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)) }), key);
  const setShape = (patch: Partial<Theme["shape"]>, key?: string) => update((t) => ({ ...t, shape: { ...t.shape, ...patch } }), key);
  const setShadow = (id: string, patch: Partial<Shadow>, key?: string) =>
    update((t) => ({ ...t, shape: { ...t.shape, shadows: t.shape.shadows.map((s) => (s.id === id ? { ...s, ...patch } : s)) } }), key);

  const r = theme.shape.radius;

  return (
    <div>
      <Group title="Corners & borders" description="The base radius sets every rounded corner on the site: cards, images, inputs.">
        <SliderField label="Corner radius" value={r} min={0} max={32} step={1} format={(v) => `${v}px`} onChange={(v) => setShape({ radius: v }, "radius")} />
        <div className="flex items-end justify-between gap-1.5" aria-hidden>
          {([["sm", 0.5], ["md", 1], ["lg", 1.5], ["xl", 2.5]] as const).map(([k, f]) => (
            <div key={k} className="flex flex-1 flex-col items-center gap-1">
              <span className="block h-9 w-full border-2 border-foreground/40 bg-muted" style={{ borderRadius: Math.round(r * f) }} />
              <span className="font-mono text-[10px] text-muted-foreground">{k}</span>
            </div>
          ))}
        </div>
        <SliderField label="Border width" value={theme.shape.borderWidth} min={0} max={4} step={1} format={(v) => `${v}px`} onChange={(v) => setShape({ borderWidth: v }, "bw")} />
      </Group>

      <Group
        title="Button styles"
        description="Colours come from the section’s scheme, so one style works on light and dark bands. Mix styles on the same page."
        action={
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 -mt-1 h-7 gap-1 px-2 text-xs"
            onClick={() => {
              const base = theme.buttons.find((b) => b.id === theme.defaultButton) ?? theme.buttons[0]!;
              const id = uniqueSlug("style", theme.buttons.map((b) => b.id));
              update((t) => ({ ...t, buttons: [...t.buttons, { ...base, id, name: "New style" }] }));
              setOpen(id);
            }}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        }
      >
        <ul className="-mx-2 space-y-2">
          {theme.buttons.map((b) => {
            const isOpen = open === b.id;
            const isDefault = b.id === theme.defaultButton;
            return (
              <li key={b.id} className={cn("overflow-hidden rounded-lg ring-1 ring-border transition-colors", isOpen && "bg-muted/60")}>
                <ThemeScope theme={theme} mode={mode} button={b.id} className="flex flex-wrap items-center gap-2 px-3 py-3.5">
                  {(["primary", "secondary", "outline"] as const).map((e) => (
                    <span key={e} className="qb-button" data-emphasis={e} data-button-style={b.id} data-size="sm" style={{ pointerEvents: "none", fontSize: 12 }}>
                      {emphasisLabel[e]}
                    </span>
                  ))}
                </ThemeScope>
                <button type="button" className="flex w-full items-center gap-2 border-t px-3 py-2 text-left" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{b.name}</span>
                  {isDefault && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">Default</span>}
                  <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="space-y-3.5 border-t px-3 pt-3 pb-3">
                    <Field label="Name">
                      <Input className="h-8 text-[13px]" value={b.name} onChange={(e) => setButton(b.id, { name: e.target.value }, `bname:${b.id}`)} />
                    </Field>
                    <Field label="Corners">
                      <ToggleGroup type="single" variant="outline" size="sm" value={b.radius} onValueChange={(v) => v && setButton(b.id, { radius: v as ButtonStyle["radius"] })} className="w-full">
                        {radiusSteps.map((s) => (
                          <ToggleGroupItem key={s} value={s} className="flex-1 px-0 text-[11px]" aria-label={s}>{s === "none" ? "0" : s}</ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Font">
                        <Select value={b.fontRole} onValueChange={(v) => setButton(b.id, { fontRole: v as ButtonStyle["fontRole"] })}>
                          <SelectTrigger size="sm" className="h-8 w-full text-xs capitalize"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {fontRoles.map((f) => <SelectItem key={f} value={f} className="text-xs capitalize">{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Weight">
                        <Select value={String(b.weight)} onValueChange={(v) => setButton(b.id, { weight: Number(v) })}>
                          <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[300, 400, 500, 600, 700, 800, 900].map((w) => <SelectItem key={w} value={String(w)} className="text-xs">{w} · {weightNames[w]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Hover">
                        <Select value={b.hover} onValueChange={(v) => setButton(b.id, { hover: v as ButtonStyle["hover"] })}>
                          <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(hoverLabel).map(([k, l]) => <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Shadow">
                        <Select value={b.shadow ?? "__none"} onValueChange={(v) => setButton(b.id, { shadow: v === "__none" ? null : v })}>
                          <SelectTrigger size="sm" className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none" className="text-xs">None</SelectItem>
                            {theme.shape.shadows.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <SliderField label="Border" value={b.borderWidth} min={0} max={4} step={1} format={(v) => `${v}px`} onChange={(v) => setButton(b.id, { borderWidth: v }, `bbw:${b.id}`)} />
                    <SliderField label="Padding · sides" value={b.paddingX} min={1} max={12} step={1} onChange={(v) => setButton(b.id, { paddingX: v }, `bpx:${b.id}`)} />
                    <SliderField label="Padding · height" value={b.paddingY} min={1} max={8} step={1} onChange={(v) => setButton(b.id, { paddingY: v }, `bpy:${b.id}`)} />
                    <SliderField label="Letter spacing" value={b.tracking} min={-0.05} max={0.2} step={0.01} format={(v) => `${v.toFixed(2)}em`} onChange={(v) => setButton(b.id, { tracking: v }, `btr:${b.id}`)} />
                    <Field label="All caps" inline>
                      <Switch checked={b.uppercase} onCheckedChange={(uppercase) => setButton(b.id, { uppercase })} aria-label="All caps" />
                    </Field>
                    <div className="flex items-center gap-1.5 border-t pt-3">
                      {!isDefault && (
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => update((t) => ({ ...t, defaultButton: b.id }))}>
                          <Star className="size-3.5" /> Make default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          const id = uniqueSlug(b.id, theme.buttons.map((x) => x.id));
                          update((t) => ({ ...t, buttons: [...t.buttons, { ...b, id, name: `${b.name} copy` }] }));
                          setOpen(id);
                        }}
                      >
                        <Copy className="size-3.5" /> Duplicate
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={isDefault || theme.buttons.length <= 1}
                        aria-label="Delete style"
                        onClick={() => update((t) => ({ ...t, buttons: t.buttons.filter((x) => x.id !== b.id) }))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Group>

      <Group
        title="Shadows"
        description="Named elevations used by buttons and cards."
        action={
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 -mt-1 h-7 gap-1 px-2 text-xs"
            onClick={() => {
              const id = uniqueSlug("shadow", theme.shape.shadows.map((s) => s.id));
              const ink = theme.palette.find((p) => p.group === "neutral") ?? theme.palette[0]!;
              update((t) => ({ ...t, shape: { ...t.shape, shadows: [...t.shape.shadows, { id, name: "New shadow", x: 0, y: 6, blur: 18, spread: 0, color: { token: ink.id, mix: { alpha: 0.15 } } }] } }));
              setOpenShadow(id);
            }}
          >
            <Plus className="size-3.5" /> Add
          </Button>
        }
      >
        {theme.shape.shadows.length === 0 && <p className="text-xs text-muted-foreground italic">No shadows. Flat is a style too.</p>}
        <ul className="-mx-2 space-y-1">
          {theme.shape.shadows.map((s) => {
            const ref = normalizeRef(s.color);
            const isOpen = openShadow === s.id;
            return (
              <li key={s.id} className={cn("rounded-lg", isOpen ? "bg-muted/60 ring-1 ring-border" : "hover:bg-muted/50")}>
                <button type="button" className="flex w-full items-center gap-3 px-2 py-2 text-left" onClick={() => setOpenShadow(isOpen ? null : s.id)} aria-expanded={isOpen}>
                  <ThemeScope theme={theme} mode={mode} className="rounded-md p-1.5">
                    <span
                      className="block size-7 rounded-md"
                      style={{ background: "var(--qb-surface)", boxShadow: `var(--qb-shadow-${s.id})` }}
                    />
                  </ThemeScope>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</span>
                  <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="space-y-3.5 px-2 pt-1 pb-3">
                    <Field label="Name">
                      <Input className="h-8 text-[13px]" value={s.name} onChange={(e) => setShadow(s.id, { name: e.target.value }, `shn:${s.id}`)} />
                    </Field>
                    <Field label="Colour">
                      <TokenSelect theme={theme} value={ref.token} onChange={(token) => token && setShadow(s.id, { color: { token, mix: ref.mix } })} />
                    </Field>
                    <SliderField label="Strength" value={ref.mix?.alpha ?? 1} min={0} max={0.6} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setShadow(s.id, { color: { token: ref.token, mix: { ...ref.mix, alpha: v } } }, `sha:${s.id}`)} />
                    <SliderField label="Offset" value={s.y} min={0} max={48} step={1} format={(v) => `${v}px`} onChange={(v) => setShadow(s.id, { y: v }, `shy:${s.id}`)} />
                    <SliderField label="Blur" value={s.blur} min={0} max={80} step={1} format={(v) => `${v}px`} onChange={(v) => setShadow(s.id, { blur: v }, `shb:${s.id}`)} />
                    <SliderField label="Spread" value={s.spread} min={-16} max={16} step={1} format={(v) => `${v}px`} onChange={(v) => setShadow(s.id, { spread: v }, `shs:${s.id}`)} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={theme.buttons.some((b) => b.shadow === s.id)}
                      onClick={() => update((t) => ({ ...t, shape: { ...t.shape, shadows: t.shape.shadows.filter((x) => x.id !== s.id) } }))}
                    >
                      <Trash2 className="size-3.5" /> {theme.buttons.some((b) => b.shadow === s.id) ? "Used by a button style" : "Delete shadow"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Group>
    </div>
  );
}

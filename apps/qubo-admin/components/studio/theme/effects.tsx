"use client";

import { startEffect } from "@qubo/blocks/runtime";
import { effectKinds, resolveRoleColor, roleVar, type Effect, type EffectKind, type Mode, type Role, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, Group, SliderField, uniqueSlug } from "./controls";
import { AddButton, duplicateIn, NameInput, PaintField, PresetRows, type ThemeUpdate } from "./design-controls";
import { ThemeScope } from "./preview";

const kindLabel: Record<EffectKind, string> = { snow: "Snow", particles: "Floating particles", aurora: "Aurora", grain: "Film grain" };
const NONE = "__none";
const BACKDROPS: Role[] = ["background", "primary", "heading", "accent"];
const INK: Record<string, [Role, Role]> = { background: ["heading", "textMuted"], primary: ["onPrimary", "onPrimary"], heading: ["background", "background"], accent: ["onAccent", "onAccent"] };

/**
 * The scheme and backdrop where the effect colour stands out most, so white snow is not
 * previewed on white. A "background" coloured effect matches every scheme's own background,
 * so the stage then falls back to the strongest contrasting role as a backdrop.
 */
function stageFor(theme: Theme, mode: Mode, effect: Effect): { scheme: string; backdrop: Role } {
  let best = { scheme: theme.defaultScheme, backdrop: "background" as Role };
  let score = -1;
  for (const s of theme.schemes) {
    const fg = resolveRoleColor(theme, s, mode, effect.color.role);
    for (const backdrop of BACKDROPS) {
      const bg = resolveRoleColor(theme, s, mode, backdrop);
      // Prefer the scheme's own background unless it is clearly too close.
      const d = bg && fg ? Math.abs(bg.l - fg.l) - (backdrop === "background" ? 0 : 0.15) : 0;
      if (d > score + 0.05) {
        best = { scheme: s.id, backdrop };
        score = d;
      }
    }
  }
  return best;
}

/** A themed stage running the real effect (CSS for aurora/grain, the canvas engine for the rest). */
export function EffectStage({ theme, mode, effect, scheme, className, children }: { theme: Theme; mode: Mode; effect: Effect; scheme?: string; className?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const auto = stageFor(theme, mode, effect);
  const sc = scheme ?? auto.scheme;
  const backdrop = scheme ? "background" : auto.backdrop;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = startEffect(el, { reduced });
    return () => h.stop();
    // Restart when the particle field changes; palette edits are picked up by the engine's periodic re-read.
  }, [effect.kind, effect.density, effect.size, effect.speed, effect.color.role, effect.color.alpha, theme.id, mode, sc, backdrop, reduced]);
  return (
    <ThemeScope theme={theme} mode={mode} scheme={sc} className={cn("relative isolate overflow-hidden rounded-md ring-1 ring-border", className)} style={{ background: `var(${roleVar(backdrop)})`, "--qb-stage-ink": `var(${roleVar(INK[backdrop]![0])})`, "--qb-stage-muted": `var(${roleVar(INK[backdrop]![1])})` } as React.CSSProperties}>
      <div ref={ref} className="qb-effect" data-effect={effect.id} data-effect-kind={effect.kind} data-effect-scope="section" aria-hidden />
      {children}
    </ThemeScope>
  );
}

export function EffectsPage({ theme, update, mode }: { theme: Theme; update: ThemeUpdate; mode: Mode }) {
  const [open, setOpen] = useState<string | null>(null);
  const fx = theme.effects;
  const setFx = (patch: Partial<Theme["effects"]>, key?: string) => update((t) => ({ ...t, effects: { ...t.effects, ...patch } }), key);
  const setList = (fn: (l: Effect[]) => Effect[], key?: string) => update((t) => ({ ...t, effects: { ...t.effects, presets: fn(t.effects.presets) } }), key);
  const current = fx.presets.find((e) => e.id === open);

  if (current) {
    return (
      <EffectEditor
        theme={theme}
        mode={mode}
        effect={current}
        onBack={() => setOpen(null)}
        onChange={(e, key) => setList((l) => l.map((x) => (x.id === e.id ? e : x)), key)}
      />
    );
  }

  return (
    <div>
      <Group title="Site-wide" description="One effect over every page. Sections can still pick their own in Section style.">
        <Field label="Effect" inline>
          <Select value={fx.active || NONE} onValueChange={(v) => setFx({ active: v === NONE ? "" : v })}>
            <SelectTrigger size="sm" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} className="text-xs">None</SelectItem>
              {fx.presets.map((e) => <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className={cn("space-y-3", !fx.active && "pointer-events-none opacity-50")}>
          <Field label="Only between dates" hint="Wraps the new year, e.g. 12-01 to 01-06." inline>
            <Switch checked={fx.schedule.enabled} onCheckedChange={(enabled) => setFx({ schedule: { ...fx.schedule, enabled } })} />
          </Field>
          {fx.schedule.enabled && (
            <div className="grid grid-cols-2 gap-2">
              <DayInput label="From" value={fx.schedule.from} onChange={(from) => setFx({ schedule: { ...fx.schedule, from } })} />
              <DayInput label="To" value={fx.schedule.to} onChange={(to) => setFx({ schedule: { ...fx.schedule, to } })} />
            </div>
          )}
        </div>
      </Group>
      <Group title="Effect presets" description="Ambient layers behind content. They pause off-screen and stay still for visitors who prefer reduced motion.">
        <PresetRows
          items={fx.presets}
          preview={(e) => <EffectStage theme={theme} mode={mode} effect={e} className="h-9 w-14" />}
          meta={(e) => kindLabel[e.kind]}
          badge={(e) => (e.id === fx.active ? <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">Site-wide</span> : null)}
          onOpen={setOpen}
          onDuplicate={(id) => {
            const r = duplicateIn(fx.presets, id);
            setList(() => r.list);
            setOpen(r.id);
          }}
          onDelete={(id) => update((t) => ({ ...t, effects: { ...t.effects, presets: t.effects.presets.filter((e) => e.id !== id), active: t.effects.active === id ? "" : t.effects.active } }))}
        />
        <AddButton
          label="New effect"
          onClick={() => {
            const id = uniqueSlug("effect", fx.presets.map((e) => e.id));
            setList((l) => [...l, { id, name: "New effect", kind: "particles", color: { role: "accentText", alpha: 0.6 }, density: 20, speed: 1, size: 1 }]);
            setOpen(id);
          }}
        />
      </Group>
    </div>
  );
}

function DayInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(text);
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (valid ? onChange(text) : setText(value))}
        placeholder="MM-DD"
        aria-invalid={!valid}
        className="h-8 font-mono text-xs"
      />
    </label>
  );
}

function EffectEditor({ theme, mode, effect: e, onChange, onBack }: { theme: Theme; mode: Mode; effect: Effect; onChange: (e: Effect, key?: string) => void; onBack: () => void }) {
  const set = (patch: Partial<Effect>, key?: string) => onChange({ ...e, ...patch }, key);
  const particles = e.kind === "snow" || e.kind === "particles";
  return (
    <div>
      <div className="sticky top-0 z-[5] border-b bg-background p-4">
        <EffectStage theme={theme} mode={mode} effect={e} className="aspect-[16/10] w-full">
          <div className="relative flex size-full flex-col justify-end p-4">
            <span className="qb-font-heading" style={{ fontSize: 20, lineHeight: 1.15, color: "var(--qb-stage-ink)" }}>Winter service</span>
            <span className="qb-font-body" style={{ fontSize: 12, color: "var(--qb-stage-muted)", opacity: 0.85 }}>The effect sits behind the content.</span>
          </div>
        </EffectStage>
        <button type="button" onClick={onBack} className="mt-2 text-xs text-muted-foreground hover:text-foreground">All effects</button>
      </div>
      <Group>
        <NameInput value={e.name} onChange={(name) => set({ name }, "name")} />
        <Field label="Kind" inline>
          <Select value={e.kind} onValueChange={(v) => set({ kind: v as EffectKind })}>
            <SelectTrigger size="sm" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {effectKinds.map((k) => <SelectItem key={k} value={k} className="text-xs">{kindLabel[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <PaintField theme={theme} mode={mode} label="Colour" value={e.color} onChange={(color) => set({ color }, "color")} />
        {particles && <SliderField label="Density" value={e.density} min={1} max={100} format={(v) => String(v)} onChange={(density) => set({ density }, "density")} />}
        {e.kind !== "grain" && <SliderField label="Speed" value={e.speed} min={0.1} max={4} step={0.1} format={(v) => `×${v.toFixed(1)}`} onChange={(speed) => set({ speed }, "speed")} />}
        {e.kind !== "aurora" && <SliderField label="Size" value={e.size} min={0.25} max={4} step={0.25} format={(v) => `×${v}`} onChange={(size) => set({ size }, "size")} />}
      </Group>
    </div>
  );
}

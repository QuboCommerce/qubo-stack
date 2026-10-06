"use client";

import { gradientKinds, type Gradient, type Mode, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { X } from "lucide-react";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Group, SliderField, uniqueSlug } from "./controls";
import { AddButton, duplicateIn, NameInput, PaintField, PresetRows, type ThemeUpdate } from "./design-controls";
import { ThemeScope } from "./preview";

const kindLabel: Record<Gradient["kind"], string> = { linear: "Linear", radial: "Radial", conic: "Conic" };

/** A themed box painted with the compiled `[data-gradient]` rule, so it is the real output. */
export function GradientSwatch({ theme, mode, id, className, children }: { theme: Theme; mode: Mode; id: string; className?: string; children?: React.ReactNode }) {
  return (
    <ThemeScope theme={theme} mode={mode} className={cn("overflow-hidden rounded-md ring-1 ring-border", className)} style={{ background: "var(--qb-background)" }}>
      <div data-gradient={id} className="size-full">{children}</div>
    </ThemeScope>
  );
}

export function GradientsPage({ theme, update, mode }: { theme: Theme; update: ThemeUpdate; mode: Mode }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = theme.surfaces.gradients;
  const setList = (fn: (l: Gradient[]) => Gradient[], key?: string) => update((t) => ({ ...t, surfaces: { ...t.surfaces, gradients: fn(t.surfaces.gradients) } }), key);
  const current = list.find((g) => g.id === open);

  if (current) {
    return <GradientEditor theme={theme} mode={mode} gradient={current} onBack={() => setOpen(null)} onChange={(g, key) => setList((l) => l.map((x) => (x.id === g.id ? g : x)), key)} />;
  }

  return (
    <Group title="Gradients" description="Section backgrounds built from scheme colours, so they recolour with every scheme and mode.">
      <PresetRows
        items={list}
        preview={(g) => <GradientSwatch theme={theme} mode={mode} id={g.id} className="h-9 w-14" />}
        meta={(g) => `${kindLabel[g.kind]} · ${g.stops.length} stops`}
        onOpen={setOpen}
        onDuplicate={(id) => {
          const r = duplicateIn(list, id);
          setList(() => r.list);
          setOpen(r.id);
        }}
        onDelete={(id) => setList((l) => l.filter((g) => g.id !== id))}
      />
      <AddButton
        label="New gradient"
        onClick={() => {
          const id = uniqueSlug("gradient", list.map((g) => g.id));
          setList((l) => [
            ...l,
            { id, name: "New gradient", kind: "linear", angle: 180, x: 50, y: 0, stops: [{ role: "primary", alpha: 0.2, at: 0 }, { role: "background", alpha: 0, at: 100 }] },
          ]);
          setOpen(id);
        }}
      />
    </Group>
  );
}

function GradientEditor({ theme, mode, gradient: g, onChange, onBack }: { theme: Theme; mode: Mode; gradient: Gradient; onChange: (g: Gradient, key?: string) => void; onBack: () => void }) {
  const set = (patch: Partial<Gradient>, key?: string) => onChange({ ...g, ...patch }, key);
  const setStop = (i: number, patch: Partial<Gradient["stops"][number]>, key?: string) => set({ stops: g.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, key);
  return (
    <div>
      <div className="sticky top-0 z-[5] border-b bg-background p-4">
        <GradientSwatch theme={theme} mode={mode} id={g.id} className="aspect-[16/9] w-full">
          <div className="flex size-full flex-col justify-end gap-1 p-4" style={{ color: "var(--qb-heading)" }}>
            <span className="qb-font-heading" style={{ fontSize: 20, lineHeight: 1.15 }}>Section heading</span>
            <span className="qb-font-body" style={{ fontSize: 12, color: "var(--qb-text-muted)" }}>Body text sits on top of the gradient.</span>
          </div>
        </GradientSwatch>
        <button type="button" onClick={onBack} className="mt-2 text-xs text-muted-foreground hover:text-foreground">All gradients</button>
      </div>
      <Group>
        <NameInput value={g.name} onChange={(name) => set({ name }, "name")} />
        <ToggleGroup type="single" variant="outline" size="sm" value={g.kind} onValueChange={(v) => v && set({ kind: v as Gradient["kind"] })} className="w-full">
          {gradientKinds.map((k) => <ToggleGroupItem key={k} value={k} className="flex-1 text-xs">{kindLabel[k]}</ToggleGroupItem>)}
        </ToggleGroup>
        {g.kind !== "radial" && <SliderField label="Angle" value={g.angle} min={0} max={360} step={5} format={(v) => `${v}°`} onChange={(angle) => set({ angle }, "angle")} />}
        {g.kind !== "linear" && (
          <div className="grid grid-cols-2 gap-3">
            <SliderField label="Centre X" value={g.x} min={0} max={100} format={(v) => `${v}%`} onChange={(x) => set({ x }, "x")} />
            <SliderField label="Centre Y" value={g.y} min={0} max={100} format={(v) => `${v}%`} onChange={(y) => set({ y }, "y")} />
          </div>
        )}
      </Group>
      <Group title="Stops" description="Colours come from the section’s scheme. Fade to 0% opacity to blend into the page.">
        {g.stops.map((s, i) => (
          <div key={i} className="relative space-y-2 rounded-lg border p-3">
            {g.stops.length > 2 && (
              <button type="button" onClick={() => set({ stops: g.stops.filter((_, j) => j !== i) })} className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove stop ${i + 1}`}>
                <X className="size-3.5" />
              </button>
            )}
            <PaintField theme={theme} mode={mode} label={`Stop ${i + 1}`} value={s} onChange={(p) => setStop(i, p, `stop-${i}`)} />
            <SliderField label="Position" value={s.at} min={0} max={100} format={(v) => `${v}%`} onChange={(at) => setStop(i, { at }, `stop-at-${i}`)} />
          </div>
        ))}
        {g.stops.length < 6 && (
          <AddButton label="Add stop" onClick={() => set({ stops: [...g.stops, { role: "background", alpha: 0, at: 100 }] })} />
        )}
      </Group>
    </div>
  );
}

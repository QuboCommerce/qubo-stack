"use client";

import { DecorMark } from "@qubo/blocks";
import { decorKinds, type Decor, type DecorKind, type Mode, type Theme } from "@qubo/stylekit";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, Group, SliderField, uniqueSlug } from "./controls";
import { AddButton, duplicateIn, NameInput, PaintField, PresetRows, type ThemeUpdate } from "./design-controls";
import { ThemeScope } from "./preview";

export const decorKindLabel: Record<DecorKind, string> = {
  color: "Colour",
  underline: "Underline",
  squiggle: "Squiggle",
  stroke: "Brush stroke",
  box: "Box",
  circle: "Circle",
  marker: "Marker",
  gradient: "Gradient text",
};
const lined = new Set<DecorKind>(["underline", "squiggle", "box", "circle"]);

/** "Words that <matter>" with the real decor CSS; `nonce` replays the draw-in. */
export function DecorSample({ theme, mode, decor, size = 15, nonce = 0, text = ["Words that", "matter", ""] }: { theme: Theme; mode: Mode; decor: Decor; size?: number; nonce?: number; text?: [string, string, string] }) {
  return (
    <ThemeScope theme={theme} mode={mode} style={{ background: "var(--qb-background)" }} className="rounded-md px-2.5 py-2 ring-1 ring-border">
      <span key={nonce} className="qb-font-heading block whitespace-nowrap" style={{ fontSize: size, lineHeight: 1.25, color: "var(--qb-heading)" }}>
        {text[0]} <DecorMark preset={decor}>{text[1]}</DecorMark>
        {text[2]}
      </span>
    </ThemeScope>
  );
}

export function DecorPage({ theme, update, mode }: { theme: Theme; update: ThemeUpdate; mode: Mode }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = theme.decor;
  const setList = (fn: (l: Decor[]) => Decor[], key?: string) => update((t) => ({ ...t, decor: fn(t.decor) }), key);
  const current = list.find((d) => d.id === open);

  if (current) {
    return <DecorEditor theme={theme} mode={mode} decor={current} onBack={() => setOpen(null)} onChange={(d, key) => setList((l) => l.map((x) => (x.id === d.id ? d : x)), key)} />;
  }

  return (
    <Group title="Word highlights" description="Marks for key words in headings. Pick the words per language in the block’s Highlight field.">
      <PresetRows
        items={list}
        preview={(d) => (
          <span className="block w-32 overflow-hidden">
            <DecorSample theme={theme} mode={mode} decor={d} size={13} text={["", "matter", ""]} />
          </span>
        )}
        meta={(d) => decorKindLabel[d.kind]}
        onOpen={setOpen}
        onDuplicate={(id) => {
          const r = duplicateIn(list, id);
          setList(() => r.list);
          setOpen(r.id);
        }}
        onDelete={(id) => setList((l) => l.filter((d) => d.id !== id))}
      />
      <AddButton
        label="New highlight"
        onClick={() => {
          const id = uniqueSlug("highlight", list.map((d) => d.id));
          setList((l) => [...l, { id, name: "New highlight", kind: "underline", color: { role: "accentText", alpha: 1 }, thickness: 3, tintText: false, animate: true }]);
          setOpen(id);
        }}
      />
    </Group>
  );
}

function DecorEditor({ theme, mode, decor: d, onChange, onBack }: { theme: Theme; mode: Mode; decor: Decor; onChange: (d: Decor, key?: string) => void; onBack: () => void }) {
  const [nonce, setNonce] = useState(0);
  const set = (patch: Partial<Decor>, key?: string) => onChange({ ...d, ...patch }, key);
  return (
    <div>
      <div className="sticky top-0 z-[5] border-b bg-background p-4">
        <div className="relative">
          <DecorSample theme={theme} mode={mode} decor={d} size={26} nonce={nonce} text={["Cold that", "lasts", "."]} />
          {d.animate && (
            <Button variant="ghost" size="icon" className="absolute top-1 right-1 size-7" onClick={() => setNonce((n) => n + 1)} aria-label="Replay">
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
        <button type="button" onClick={onBack} className="mt-2 text-xs text-muted-foreground hover:text-foreground">All highlights</button>
      </div>
      <Group>
        <NameInput value={d.name} onChange={(name) => set({ name }, "name")} />
        <Field label="Style" inline>
          <Select value={d.kind} onValueChange={(v) => set({ kind: v as DecorKind })}>
            <SelectTrigger size="sm" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {decorKinds.map((k) => <SelectItem key={k} value={k} className="text-xs">{decorKindLabel[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <PaintField theme={theme} mode={mode} label="Colour" value={d.color} onChange={(color) => set({ color }, "color")} />
        {lined.has(d.kind) && <SliderField label="Line weight" value={d.thickness} min={1} max={16} format={(v) => `${v}px`} onChange={(thickness) => set({ thickness }, "thickness")} />}
        {d.kind !== "color" && d.kind !== "gradient" && (
          <Field label="Colour the words too" inline>
            <Switch checked={d.tintText} onCheckedChange={(tintText) => set({ tintText })} />
          </Field>
        )}
        {d.kind !== "color" && d.kind !== "gradient" && (
          <Field label="Draw in" hint="Animates once as the heading appears." inline>
            <Switch checked={d.animate} onCheckedChange={(animate) => set({ animate })} />
          </Field>
        )}
      </Group>
    </div>
  );
}

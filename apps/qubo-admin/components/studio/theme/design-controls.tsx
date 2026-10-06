"use client";

import { easingPresets, formatOklch, resolveRoleColor, roles, type Mode, type Paint, type Role, type Theme } from "@qubo/stylekit";
import { cn } from "@qubo/shared/utils";
import { Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SliderField, Swatch, uniqueSlug } from "./controls";
import { describeRole } from "./palette";

export type ThemeUpdate = (fn: (t: Theme) => Theme, key?: string) => void;

// ------------------------------------------------------------------ paint ---

export function roleSwatch(theme: Theme, mode: Mode, role: Role): string | undefined {
  const scheme = theme.schemes.find((s) => s.id === theme.defaultScheme) ?? theme.schemes[0];
  const c = scheme ? resolveRoleColor(theme, scheme, mode, role) : null;
  return c ? formatOklch(c) : undefined;
}

/** Role + opacity. Roles follow the section's colour scheme, so one preset works everywhere. */
export function PaintField({
  theme,
  mode,
  label,
  value,
  onChange,
  alpha = true,
}: {
  theme: Theme;
  mode: Mode;
  label: string;
  value: Paint;
  onChange: (p: Paint) => void;
  alpha?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">{label}</span>
        <Select value={value.role} onValueChange={(v) => onChange({ ...value, role: v as Role })}>
          <SelectTrigger size="sm" className="h-8 w-44 gap-2 text-xs" aria-label={`${label} colour`}>
            <SelectValue>
              <span className="flex min-w-0 items-center gap-2">
                <Swatch color={roleSwatch(theme, mode, value.role)} className="size-4" />
                <span className="truncate">{describeRole(value.role)}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-80">
            {roles.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                <span className="flex items-center gap-2">
                  <Swatch color={roleSwatch(theme, mode, r)} className="size-4" />
                  {describeRole(r)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {alpha && (
        <SliderField label="Opacity" value={value.alpha} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onChange({ ...value, alpha: v })} />
      )}
    </div>
  );
}

// --------------------------------------------------------------- duration ---

/** Slider in 100ms steps for feel, number box for the exact value. */
export function DurationField({
  label,
  value,
  min = 0,
  max = 3000,
  hint,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  hint?: string;
  onChange: (ms: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    else setText(String(value));
  };
  return (
    <div className={cn("space-y-2", disabled && "pointer-events-none opacity-50")}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
        <span className="flex items-center gap-1">
          <Input
            id={id}
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
            className="h-7 w-16 px-1.5 text-right font-mono text-xs tabular-nums"
            aria-label={`${label} in milliseconds`}
          />
          <span className="text-[11px] text-muted-foreground">ms</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={100} onValueChange={([v]) => v !== undefined && onChange(v)} aria-label={label} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- easing ---

const easingLabel: Record<string, string> = {
  standard: "Standard",
  gentle: "Gentle",
  snappy: "Snappy",
  linear: "Linear",
  "ease-in-out": "Ease in-out",
  overshoot: "Overshoot",
};
const THEME = "__theme";
const CUSTOM = "__custom";

/** "" = the theme curve, a preset name, or any CSS easing (custom). */
export function EasingField({ label, value, onChange, themeOption = true }: { label: string; value: string; onChange: (v: string) => void; themeOption?: boolean }) {
  const names = Object.keys(easingPresets);
  const byValue = Object.entries(easingPresets).find(([, v]) => v === value)?.[0];
  const selected = value === "" ? THEME : names.includes(value) ? value : byValue ?? CUSTOM;
  const [custom, setCustom] = useState(selected === CUSTOM ? value : "");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium">{label}</span>
        <Select
          value={selected}
          onValueChange={(v) => {
            if (v === THEME) onChange("");
            else if (v === CUSTOM) onChange(custom || "cubic-bezier(0.25, 0.1, 0.25, 1)");
            else onChange(v);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-44 text-xs" aria-label={label}><SelectValue /></SelectTrigger>
          <SelectContent>
            {themeOption && <SelectItem value={THEME} className="text-xs">Theme easing</SelectItem>}
            {names.map((n) => <SelectItem key={n} value={n} className="text-xs">{easingLabel[n] ?? n}</SelectItem>)}
            <SelectItem value={CUSTOM} className="text-xs">Custom curve…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {selected === CUSTOM && (
        <Input
          value={custom || value}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={(e) => e.target.value.trim() && onChange(e.target.value.trim())}
          placeholder="cubic-bezier(0.2, 0.8, 0.2, 1)"
          className="h-8 font-mono text-xs"
          aria-label={`${label} curve`}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------- preset lists ---

/** Rows of named presets with a live preview; click to edit, menu to duplicate or delete. */
export function PresetRows<T extends { id: string; name: string }>({
  items,
  preview,
  meta,
  badge,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  items: T[];
  preview: (item: T) => ReactNode;
  meta?: (item: T) => ReactNode;
  badge?: (item: T) => ReactNode;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id} className="group flex items-center gap-2 rounded-lg pr-1 hover:bg-muted/60">
          <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left">
            <span className="shrink-0">{preview(item)}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                {item.name}
                {badge?.(item)}
              </span>
              {meta && <span className="block truncate text-xs text-muted-foreground">{meta(item)}</span>}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={`${item.name} actions`}>
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onDuplicate(item.id)}><Copy /> Duplicate</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item.id)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="h-8 w-full justify-center gap-1.5 border-dashed text-xs" onClick={onClick}>
      <Plus className="size-3.5" /> {label}
    </Button>
  );
}

/** Copy of `item` with a fresh id and "copy" name, inserted after it. */
export function duplicateIn<T extends { id: string; name: string }>(list: T[], id: string): { list: T[]; id: string | null } {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return { list, id: null };
  const src = list[i]!;
  const copy = { ...structuredClone(src), id: uniqueSlug(`${src.id}-copy`, list.map((x) => x.id)), name: `${src.name} copy` };
  return { list: [...list.slice(0, i + 1), copy, ...list.slice(i + 1)], id: copy.id };
}

export function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-[13px] font-medium" aria-label="Preset name" placeholder="Name" />
  );
}

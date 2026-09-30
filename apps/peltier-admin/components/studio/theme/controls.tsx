"use client";

import {
  formatOklch,
  parseColor,
  toHex,
  type ColorMix,
  type Oklch,
  type PaletteToken,
  type Theme,
} from "@peltier/stylekit";
import { cn } from "@peltier/shared/utils";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Slider as SliderPrimitive } from "radix-ui";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// ------------------------------------------------------------ panel chrome ---

export function SubHeader({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack: () => void; actions?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-1 border-b bg-background/95 px-1.5 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Back"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A titled block of controls; groups are separated by hairlines, not cards. */
export function Group({ title, description, action, children, className }: { title?: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-b px-4 py-4 last:border-b-0", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>}
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

export function NavRow({
  icon,
  label,
  meta,
  onClick,
  tone,
}: {
  icon: ReactNode;
  label: string;
  meta?: ReactNode;
  onClick: () => void;
  tone?: "warning" | "error";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground group-hover:bg-background [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        {meta && (
          <span className={cn("block truncate text-xs text-muted-foreground", tone === "warning" && "text-amber-600", tone === "error" && "text-destructive")}>{meta}</span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

export function Field({ label, hint, htmlFor, children, inline }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; inline?: boolean }) {
  return (
    <div className={cn(inline ? "flex items-center justify-between gap-3" : "space-y-1.5")}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-[13px] font-medium">{label}</label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- sliders ---

/** Labelled slider with a live value readout and (for short ranges) tick dots. */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  const count = Math.round((max - min) / step);
  const ticks = count <= 12 ? count + 1 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{format(value)}</span>
      </div>
      <Slider id={id} value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([v]) => v !== undefined && onChange(v)} aria-label={label} />
      {ticks > 0 && (
        <div className="-mt-1 flex justify-between px-[7px]" aria-hidden>
          {Array.from({ length: ticks }, (_, i) => (
            <span key={i} className={cn("size-1 rounded-full", min + i * step <= value ? "bg-primary/60" : "bg-muted-foreground/25")} />
          ))}
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Slider whose track paints the channel it controls (lightness, chroma, hue). */
function ChannelSlider({
  label,
  value,
  min,
  max,
  step,
  gradient,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  gradient: string;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr_3.25rem] items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => v !== undefined && onChange(v)}
        className="relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50"
        aria-label={label}
      >
        <SliderPrimitive.Track className="relative h-3 grow rounded-full ring-1 ring-black/10 ring-inset" style={{ background: gradient }} />
        <SliderPrimitive.Thumb className="block size-4 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,.35),0_1px_3px_rgba(0,0,0,.3)] focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none" />
      </SliderPrimitive.Root>
      <span className="text-right font-mono text-[11px] text-muted-foreground tabular-nums">{format(value)}</span>
    </div>
  );
}

// ----------------------------------------------------------------- colour ---

const CHECKER =
  "repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%) 50% / 8px 8px";

export function Swatch({ color, className, title }: { color: string | null | undefined; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("relative inline-block size-5 shrink-0 overflow-hidden rounded-[5px] ring-1 ring-black/10 ring-inset", className)}
      style={{ background: CHECKER }}
    >
      <span className="absolute inset-0" style={{ background: color ?? "transparent" }} />
    </span>
  );
}

export const cssColor = (c: Oklch | null | undefined) => (c ? formatOklch(c) : undefined);

/**
 * OKLCH editor: perceptual sliders (L/C/H/alpha) plus hex and raw CSS input.
 * OKLCH is what makes "a bit brighter" a single, predictable nudge.
 */
export function ColorEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const parsed = parseColor(value);
  const [text, setText] = useState(value);
  const [hex, setHex] = useState(parsed ? toHex(parsed) : "");
  useEffect(() => {
    setText(value);
    const p = parseColor(value);
    if (p) setHex(toHex(p));
  }, [value]);

  const c = parsed ?? ({ mode: "oklch", l: 0.5, c: 0, h: 0 } as Oklch);
  const set = (patch: Partial<Oklch>) => onChange(formatOklch({ ...c, ...patch }));
  const L = c.l, C = c.c, H = c.h ?? 0, A = c.alpha ?? 1;

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <label className={cn("relative size-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10 ring-inset", !disabled && "cursor-pointer")} style={{ background: CHECKER }}>
          <span className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={disabled}
            value={parsed ? toHex(parsed) : "#000000"}
            onChange={(e) => {
              const p = parseColor(e.target.value);
              if (p) onChange(formatOklch({ ...p, alpha: c.alpha }));
            }}
            aria-label="Pick colour"
          />
        </label>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Input
            value={hex}
            disabled={disabled}
            spellCheck={false}
            className="h-7 font-mono text-xs uppercase"
            aria-label="Hex"
            onChange={(e) => {
              setHex(e.target.value);
              const p = /^#?[0-9a-f]{3,8}$/i.test(e.target.value.trim()) ? parseColor(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`) : null;
              if (p) onChange(formatOklch(p));
            }}
          />
          <Input
            value={text}
            disabled={disabled}
            spellCheck={false}
            className={cn("h-7 font-mono text-[11px]", !parseColor(text) && "border-destructive")}
            aria-label="CSS colour"
            onChange={(e) => {
              setText(e.target.value);
              if (parseColor(e.target.value)) onChange(e.target.value.trim());
            }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <ChannelSlider
          label="L"
          value={L}
          min={0}
          max={1}
          step={0.005}
          disabled={disabled}
          format={(v) => `${Math.round(v * 100)}%`}
          gradient={`linear-gradient(to right in oklch, oklch(0 ${C} ${H}), oklch(0.5 ${C} ${H}), oklch(1 ${C} ${H}))`}
          onChange={(l) => set({ l })}
        />
        <ChannelSlider
          label="C"
          value={C}
          min={0}
          max={0.37}
          step={0.002}
          disabled={disabled}
          format={(v) => v.toFixed(3)}
          gradient={`linear-gradient(to right in oklch, oklch(${L} 0 ${H}), oklch(${L} 0.37 ${H}))`}
          onChange={(cc) => set({ c: cc })}
        />
        <ChannelSlider
          label="H"
          value={H}
          min={0}
          max={360}
          step={1}
          disabled={disabled}
          format={(v) => `${Math.round(v)}°`}
          gradient={`linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `oklch(${Math.max(L, 0.55)} ${Math.max(C, 0.12)} ${h})`).join(", ")})`}
          onChange={(h) => set({ h })}
        />
        <ChannelSlider
          label="α"
          value={A}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          format={(v) => `${Math.round(v * 100)}%`}
          gradient={`linear-gradient(to right, transparent, oklch(${L} ${C} ${H})), ${CHECKER}`}
          onChange={(a) => set({ alpha: a })}
        />
      </div>
    </div>
  );
}

/** Mix modifiers on a role reference: lightness nudge, chroma scale, opacity. */
export function MixEditor({ mix, onChange }: { mix: ColorMix | undefined; onChange: (m: ColorMix | undefined) => void }) {
  const m = mix ?? {};
  const patch = (p: Partial<ColorMix>) => {
    const next = { ...m, ...p };
    const clean = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => v !== undefined && !(k === "lightness" && v === 0) && !(k !== "lightness" && v === 1)),
    ) as ColorMix;
    onChange(Object.keys(clean).length ? clean : undefined);
  };
  return (
    <div className="space-y-3">
      <SliderField label="Lightness" value={m.lightness ?? 0} min={-0.3} max={0.3} step={0.01} format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}`} onChange={(v) => patch({ lightness: v })} />
      <SliderField label="Saturation" value={m.chroma ?? 1} min={0} max={2} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => patch({ chroma: v })} />
      <SliderField label="Opacity" value={m.alpha ?? 1} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ alpha: v })} />
    </div>
  );
}

// ------------------------------------------------------------ token picker ---

export const tokenColor = (t: PaletteToken | undefined) => {
  const p = t ? parseColor(t.value) : null;
  return p ? formatOklch(p) : undefined;
};

export const AUTO = "__auto";

/** Palette token dropdown: swatch + name + description, grouped like the palette. */
export function TokenSelect({
  theme,
  value,
  onChange,
  auto,
  className,
  ariaLabel,
}: {
  theme: Theme;
  value: string | undefined;
  onChange: (token: string | undefined) => void;
  /** Label for the "no explicit mapping" option (optional roles). */
  auto?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const groups = Array.from(new Set(theme.palette.map((t) => t.group)));
  const current = theme.palette.find((t) => t.id === value);
  return (
    <Select value={value ?? AUTO} onValueChange={(v) => onChange(v === AUTO ? undefined : v)}>
      <SelectTrigger size="sm" className={cn("h-8 w-full min-w-0 gap-2 text-xs", className)} aria-label={ariaLabel}>
        <SelectValue>
          {current ? (
            <span className="flex min-w-0 items-center gap-2">
              <Swatch color={tokenColor(current)} className="size-4" />
              <span className="truncate">{current.name}</span>
            </span>
          ) : value ? (
            <span className="truncate text-destructive">Missing “{value}”</span>
          ) : (
            <span className="truncate text-muted-foreground">{auto ?? "Automatic"}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80 w-(--radix-select-trigger-width) min-w-64">
        {auto && (
          <>
            <SelectItem value={AUTO} className="text-xs">
              <span className="text-muted-foreground">{auto}</span>
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {groups.map((g) => (
          <SelectGroup key={g}>
            <SelectLabel className="text-[10px] tracking-wide uppercase">{g}</SelectLabel>
            {theme.palette
              .filter((t) => t.group === g)
              .map((t) => (
                <SelectItem key={t.id} value={t.id} className="py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Swatch color={tokenColor(t)} className="size-5" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-xs font-medium">
                        {t.name}
                        {t.locked && <Lock className="size-3 text-muted-foreground" />}
                      </span>
                      {t.description && <span className="block max-w-56 truncate text-[11px] text-muted-foreground">{t.description}</span>}
                    </span>
                  </span>
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Lowercase slug that doesn't collide with `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>) {
  const set = new Set(taken);
  const root =
    base
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/^[^a-z]+/, "")
      .slice(0, 40) || "item";
  if (!set.has(root)) return root;
  for (let i = 2; ; i++) if (!set.has(`${root}-${i}`)) return `${root}-${i}`;
}

import {
  converter,
  differenceCiede2000,
  formatHex,
  parse,
  wcagContrast,
  type Color,
  type Oklch,
  type Rgb,
} from "culori";
import type { ColorMix } from "./schema";

export type { Color, Oklch };

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const deltaE = differenceCiede2000();

export function parseColor(value: string): Oklch | null {
  const parsed = parse(value.trim());
  if (!parsed) return null;
  const oklch = toOklch(parsed);
  return { ...oklch, h: oklch.h ?? 0 };
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** Canonical CSS for a palette value: `oklch(L C H)` or with `/ alpha`. */
export function formatOklch(color: Oklch): string {
  const l = round(Math.min(1, Math.max(0, color.l)), 4);
  const c = round(Math.max(0, color.c), 4);
  const h = round(color.h ?? 0, 2);
  const alpha = color.alpha === undefined || color.alpha >= 1 ? "" : ` / ${round(color.alpha, 3)}`;
  return `oklch(${l} ${c} ${h}${alpha})`;
}

export function toHex(color: Color): string {
  return formatHex(color) ?? "#000000";
}

export function applyMix(color: Oklch, mix?: ColorMix): Oklch {
  if (!mix) return color;
  return {
    ...color,
    l: Math.min(1, Math.max(0, color.l + (mix.lightness ?? 0))),
    c: Math.max(0, color.c * (mix.chroma ?? 1)),
    alpha: (color.alpha ?? 1) * (mix.alpha ?? 1),
  };
}

/** Flattens a translucent colour onto an opaque backdrop (for contrast). */
export function composite(top: Color, backdrop: Color): Rgb {
  const a = top.alpha ?? 1;
  const t = toRgb(top);
  const b = toRgb(backdrop);
  return {
    mode: "rgb",
    r: t.r * a + b.r * (1 - a),
    g: t.g * a + b.g * (1 - a),
    b: t.b * a + b.b * (1 - a),
  };
}

export function contrastRatio(fg: Color, bg: Color): number {
  const opaqueBg = composite(bg, { mode: "rgb", r: 1, g: 1, b: 1 });
  return round(wcagContrast(composite(fg, opaqueBg), opaqueBg), 2);
}

/** Perceptual distance (CIEDE2000); < ~5 reads as "the same colour". */
export function colorDistance(a: Color, b: Color): number {
  return round(deltaE(a, b), 2);
}

import { formatOklch, parseColor } from "./color";
import {
  activeModes,
  normalizeRef,
  resolveRoleRef,
  roleMapFor,
  type NormalizedRef,
} from "./resolve";
import type { ButtonStyle, ColorMix, Mode, Role, Scheme, Theme } from "./schema";
import { fontRoles, roles } from "./schema";

export const CSS_PREFIX = "pk";

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export const roleVar = (role: Role) => `--${CSS_PREFIX}-${kebab(role)}`;
export const tokenVar = (id: string) => `--${CSS_PREFIX}-color-${id}`;

/** Named spacing steps (in space units) used by section chrome and layout blocks. */
export const spaceSteps = {
  none: 0,
  "3xs": 1,
  "2xs": 2,
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  "4xl": 32,
} as const;
export type SpaceStep = keyof typeof spaceSteps;

/** Type scale steps; 0 is body text. */
export const typeSteps = [-2, -1, 0, 1, 2, 3, 4, 5, 6] as const;
export type TypeStep = (typeof typeSteps)[number];
export const typeStepVar = (step: number) => `--${CSS_PREFIX}-step-${step < 0 ? `n${-step}` : step}`;

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/** `clamp()` that interpolates linearly between two viewport widths. */
export function fluid(minPx: number, maxPx: number, vMin: number, vMax: number): string {
  if (Math.abs(maxPx - minPx) < 0.01) return `${round(minPx / 16)}rem`;
  const slope = (maxPx - minPx) / (vMax - vMin);
  const intercept = minPx - slope * vMin;
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  return `clamp(${round(lo / 16)}rem, ${round(intercept / 16)}rem + ${round(slope * 100, 3)}vw, ${round(hi / 16)}rem)`;
}

function colorExpression(base: string, mix?: ColorMix): string {
  if (!mix || (mix.lightness === undefined && mix.chroma === undefined && mix.alpha === undefined)) {
    return base;
  }
  const l = mix.lightness ? `calc(l ${mix.lightness < 0 ? "-" : "+"} ${Math.abs(mix.lightness)})` : "l";
  const c = mix.chroma !== undefined && mix.chroma !== 1 ? `calc(c * ${mix.chroma})` : "c";
  const a = mix.alpha !== undefined && mix.alpha !== 1 ? ` / ${mix.alpha}` : "";
  return `oklch(from ${base} ${l} ${c} h${a})`;
}

const refExpression = (ref: NormalizedRef) => colorExpression(`var(${tokenVar(ref.token)})`, ref.mix);

function roleDeclarations(scheme: Scheme, mode: Mode): string[] {
  const map = roleMapFor(scheme, mode);
  if (!map) return [];
  return roles.map((role) => {
    const r = resolveRoleRef(map, role, mode);
    const value = r.ref
      ? refExpression(r.ref)
      : colorExpression(`var(${roleVar(r.fallback!.role)})`, r.fallback!.mix);
    return `${roleVar(role)}: ${value};`;
  });
}

const block = (selector: string, decls: string[], indent = "") =>
  decls.length ? `${indent}${selector} {\n${decls.map((d) => `${indent}  ${d}`).join("\n")}\n${indent}}` : "";

export type CompileOptions = {
  /** Resolves a font file `src` (usually an asset id) to a public URL. */
  resolveAssetUrl?: (src: string) => string;
};

function fontFaces(theme: Theme, opts: CompileOptions): string[] {
  const resolve = opts.resolveAssetUrl ?? ((s: string) => s);
  return theme.typeset.fonts.flatMap((font) =>
    font.files.map((file) =>
      block("@font-face", [
        `font-family: ${JSON.stringify(font.family)};`,
        `src: url(${JSON.stringify(resolve(file.src))}) format(${JSON.stringify(file.format)});`,
        `font-weight: ${file.weight};`,
        `font-style: ${file.style};`,
        "font-display: swap;",
      ]),
    ),
  );
}

function buttonDeclarations(theme: Theme, style: ButtonStyle): string[] {
  const radius = radiusValue(theme, style.radius);
  const shadow = style.shadow ? `var(--${CSS_PREFIX}-shadow-${style.shadow})` : "none";
  const hover = {
    none: { transform: "none", filter: "none", shadow },
    darken: { transform: "none", filter: "brightness(0.92)", shadow },
    lift: { transform: "translateY(-2px)", filter: "none", shadow },
    // "Press" pairs with hard-offset shadows: the button sinks into its shadow.
    press: { transform: "translate(2px, 2px)", filter: "none", shadow: "none" },
    glow: { transform: "none", filter: "none", shadow: `0 0 0 4px oklch(from var(${roleVar("focusRing")}) l c h / 0.35)` },
  }[style.hover];
  const p = `--${CSS_PREFIX}-btn`;
  return [
    `${p}-radius: ${radius};`,
    `${p}-border-width: ${style.borderWidth}px;`,
    `${p}-shadow: ${shadow};`,
    `${p}-font: var(--${CSS_PREFIX}-font-${style.fontRole});`,
    `${p}-weight: ${style.weight};`,
    `${p}-case: ${style.uppercase ? "uppercase" : "none"};`,
    `${p}-tracking: ${style.tracking}em;`,
    `${p}-px: var(--${CSS_PREFIX}-space-${style.paddingX});`,
    `${p}-py: var(--${CSS_PREFIX}-space-${style.paddingY});`,
    `${p}-hover-transform: ${hover.transform};`,
    `${p}-hover-filter: ${hover.filter};`,
    `${p}-hover-shadow: ${hover.shadow};`,
  ];
}

function radiusValue(theme: Theme, step: ButtonStyle["radius"]): string {
  return `var(--${CSS_PREFIX}-radius-${step})`;
}

function rootDeclarations(theme: Theme): string[] {
  const d: string[] = [];
  const { typeset, space, shape, motion } = theme;

  for (const token of theme.palette) {
    const parsed = parseColor(token.value);
    d.push(`${tokenVar(token.id)}: ${parsed ? formatOklch(parsed) : token.value};`);
  }

  for (const role of fontRoles) {
    const setting = typeset.roles[role];
    const font = typeset.fonts.find((f) => f.id === setting.font) ?? typeset.fonts[0]!;
    const p = `--${CSS_PREFIX}-font-${role}`;
    d.push(
      `${p}: ${JSON.stringify(font.family)}, ${font.fallback};`,
      `${p}-weight: ${setting.weight};`,
      `${p}-tracking: ${setting.tracking}em;`,
      `${p}-leading: ${setting.lineHeight};`,
      `${p}-case: ${setting.uppercase ? "uppercase" : "none"};`,
    );
  }

  const s = typeset.scale;
  for (const step of typeSteps) {
    d.push(
      `${typeStepVar(step)}: ${fluid(s.baseMin * s.ratioMin ** step, s.baseMax * s.ratioMax ** step, s.viewportMin, s.viewportMax)};`,
    );
  }

  for (let n = 0; n <= 32; n++) {
    d.push(`--${CSS_PREFIX}-space-${n}: ${fluid(space.unitMin * n, space.unitMax * n, s.viewportMin, s.viewportMax)};`);
  }
  for (const [name, n] of Object.entries(spaceSteps)) {
    d.push(`--${CSS_PREFIX}-gap-${name}: var(--${CSS_PREFIX}-space-${n});`);
  }

  const r = shape.radius;
  d.push(
    `--${CSS_PREFIX}-radius-none: 0px;`,
    `--${CSS_PREFIX}-radius-sm: ${round(r * 0.5, 2)}px;`,
    `--${CSS_PREFIX}-radius-md: ${r}px;`,
    `--${CSS_PREFIX}-radius-lg: ${round(r * 1.5, 2)}px;`,
    `--${CSS_PREFIX}-radius-xl: ${round(r * 2.5, 2)}px;`,
    `--${CSS_PREFIX}-radius-full: 9999px;`,
    `--${CSS_PREFIX}-border-width: ${shape.borderWidth}px;`,
  );
  for (const sh of shape.shadows) {
    d.push(
      `--${CSS_PREFIX}-shadow-${sh.id}: ${sh.x}px ${sh.y}px ${sh.blur}px ${sh.spread}px ${refExpression(normalizeRef(sh.color))};`,
    );
  }

  const off = motion.profile === "none";
  d.push(
    `--${CSS_PREFIX}-duration-fast: ${off ? 0 : motion.durationFast}ms;`,
    `--${CSS_PREFIX}-duration-base: ${off ? 0 : motion.durationBase}ms;`,
    `--${CSS_PREFIX}-duration-slow: ${off ? 0 : motion.durationSlow}ms;`,
    `--${CSS_PREFIX}-ease: ${motion.easing};`,
    `--${CSS_PREFIX}-entrance-distance: ${motion.profile === "lively" ? "32px" : "12px"};`,
  );

  const defaultButton = theme.buttons.find((b) => b.id === theme.defaultButton) ?? theme.buttons[0]!;
  d.push(...buttonDeclarations(theme, defaultButton));

  d.push(`color-scheme: ${theme.modeStrategy === "dual" ? "light dark" : theme.modeStrategy};`);
  return d;
}

export type CompiledTheme = { css: string; hash: string };

/**
 * Compiles a theme to CSS scoped under `[data-theme="<id>"]`, so several
 * themes can coexist on one page (side-by-side previews, the admin itself).
 *
 * Markup contract:
 *   <html data-theme="lume" data-mode="light|dark|system" data-scheme="cream">
 *     <section data-scheme="navy-spotlight">…</section>
 */
export function compileTheme(theme: Theme, opts: CompileOptions = {}): CompiledTheme {
  const t = `[data-theme="${theme.id}"]`;
  const parts: string[] = [];

  parts.push(...fontFaces(theme, opts));
  parts.push(block(t, rootDeclarations(theme)));

  const schemeSel = (scheme: string, mode?: string) => {
    const m = mode ? `[data-mode="${mode}"]` : "";
    return [`${t}${m} [data-scheme="${scheme}"]`, `${t}${m}[data-scheme="${scheme}"]`].join(",\n");
  };
  const paint = [`background-color: var(${roleVar("background")});`, `color: var(${roleVar("text")});`];

  const [firstMode] = activeModes(theme);
  for (const scheme of theme.schemes) {
    parts.push(block(schemeSel(scheme.id), [...roleDeclarations(scheme, firstMode!), ...paint]));
  }

  if (theme.modeStrategy === "dual") {
    const dark = theme.schemes
      .filter((s) => s.dark)
      .map((s) => ({ id: s.id, decls: roleDeclarations(s, "dark") }));
    for (const s of dark) parts.push(block(schemeSel(s.id, "dark"), s.decls));
    const system = dark.map((s) => block(schemeSel(s.id, "system"), s.decls, "  ")).join("\n");
    if (system) parts.push(`@media (prefers-color-scheme: dark) {\n${system}\n}`);
  }

  for (const style of theme.buttons) {
    parts.push(block(`${t} [data-button-style="${style.id}"]`, buttonDeclarations(theme, style)));
  }

  const css = parts.filter(Boolean).join("\n\n") + "\n";
  return { css, hash: hashString(css) };
}

/** FNV-1a — stable cache key for compiled CSS; not cryptographic. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

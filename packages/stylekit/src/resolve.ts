import { applyMix, parseColor, type Oklch } from "./color";
import type {
  ColorMix,
  Mode,
  PaletteToken,
  Role,
  RoleMap,
  RoleRef,
  Scheme,
  Theme,
} from "./schema";
import { requiredRoles, roles } from "./schema";

/**
 * Where an unset optional role takes its colour from. Deltas are mode-aware:
 * an "alt" background is a touch darker on light schemes and lighter on dark.
 */
export const roleFallbacks: Record<
  Exclude<Role, (typeof requiredRoles)[number]>,
  { role: Role; mix?: (mode: Mode) => ColorMix }
> = {
  backgroundAlt: { role: "background", mix: (m) => ({ lightness: m === "light" ? -0.03 : 0.04 }) },
  surface: { role: "background", mix: (m) => ({ lightness: m === "light" ? 0.015 : 0.05 }) },
  onSurface: { role: "text" },
  textMuted: { role: "text", mix: () => ({ alpha: 0.72 }) },
  heading: { role: "text" },
  accent: { role: "primary" },
  onAccent: { role: "onPrimary" },
  accentText: { role: "link" },
  secondary: { role: "text" },
  onSecondary: { role: "background" },
  link: { role: "primary" },
  border: { role: "text", mix: () => ({ alpha: 0.14 }) },
  focusRing: { role: "primary" },
};

export type NormalizedRef = { token: string; mix?: ColorMix };

export function normalizeRef(ref: RoleRef): NormalizedRef {
  return typeof ref === "string" ? { token: ref } : ref;
}

/** Modes a theme actually renders. */
export function activeModes(theme: Pick<Theme, "modeStrategy">): Mode[] {
  return theme.modeStrategy === "dual" ? ["light", "dark"] : [theme.modeStrategy];
}

/**
 * The role map used for a mode. A dual theme missing a dark map reuses light
 * (the doctor reports it); a single-mode theme uses whichever map exists.
 */
export function roleMapFor(scheme: Scheme, mode: Mode): RoleMap | undefined {
  return scheme[mode] ?? (mode === "dark" ? scheme.light : scheme.dark);
}

export type ResolvedRole = {
  role: Role;
  /** Set when the role is explicitly mapped to a token. */
  ref?: NormalizedRef;
  /** Set when the role inherits from another role. */
  fallback?: { role: Role; mix?: ColorMix };
};

export function resolveRoleRef(map: RoleMap, role: Role, mode: Mode): ResolvedRole {
  const explicit = map[role];
  if (explicit) return { role, ref: normalizeRef(explicit) };
  const fb = roleFallbacks[role as keyof typeof roleFallbacks];
  return { role, fallback: { role: fb.role, mix: fb.mix?.(mode) } };
}

/** Computes the concrete colour of a role (for contrast checks and swatches). */
export function resolveRoleColor(
  theme: Theme,
  scheme: Scheme,
  mode: Mode,
  role: Role,
  depth = 0,
): Oklch | null {
  const map = roleMapFor(scheme, mode);
  if (!map || depth > roles.length) return null;
  const resolved = resolveRoleRef(map, role, mode);
  if (resolved.ref) {
    const token = theme.palette.find((t) => t.id === resolved.ref!.token);
    const base = token ? parseColor(token.value) : null;
    return base ? applyMix(base, resolved.ref.mix) : null;
  }
  const parent = resolveRoleColor(theme, scheme, mode, resolved.fallback!.role, depth + 1);
  return parent ? applyMix(parent, resolved.fallback!.mix) : null;
}

export type TokenUsage = { schemeId: string; mode: Mode; role: Role }[];

/** Every scheme/mode/role that references a token — the "used by" panel. */
export function usedBy(theme: Theme, tokenId: string): TokenUsage {
  const out: TokenUsage = [];
  for (const scheme of theme.schemes) {
    for (const mode of ["light", "dark"] as const) {
      const map = scheme[mode];
      if (!map) continue;
      for (const role of roles) {
        const ref = map[role];
        if (ref && normalizeRef(ref).token === tokenId) {
          out.push({ schemeId: scheme.id, mode, role });
        }
      }
    }
  }
  for (const shadow of theme.shape.shadows) {
    if (normalizeRef(shadow.color).token === tokenId) {
      out.push({ schemeId: `shadow:${shadow.id}`, mode: "light", role: "border" });
    }
  }
  return out;
}

function mapRefs(theme: Theme, fn: (ref: RoleRef) => RoleRef): Theme {
  const mapRoleMap = (map?: RoleMap) =>
    map
      ? (Object.fromEntries(
          Object.entries(map).map(([k, v]) => [k, v === undefined ? v : fn(v)]),
        ) as RoleMap)
      : undefined;
  return {
    ...theme,
    schemes: theme.schemes.map((s) => ({
      ...s,
      light: mapRoleMap(s.light),
      dark: mapRoleMap(s.dark),
    })),
    shape: {
      ...theme.shape,
      shadows: theme.shape.shadows.map((sh) => ({ ...sh, color: fn(sh.color) })),
    },
  };
}

/** Renames a palette token and rewrites every reference to it. */
export function renameToken(theme: Theme, fromId: string, toId: string): Theme {
  if (theme.palette.some((t) => t.id === toId)) {
    throw new Error(`Token "${toId}" already exists`);
  }
  const next = mapRefs(theme, (ref) => {
    const n = normalizeRef(ref);
    if (n.token !== fromId) return ref;
    return typeof ref === "string" ? toId : { ...n, token: toId };
  });
  return {
    ...next,
    palette: theme.palette.map((t): PaletteToken => (t.id === fromId ? { ...t, id: toId } : t)),
  };
}

/**
 * Collapses a dual theme to a single mode ("we only ever design on white").
 * The chosen mode's mappings survive; the other set is dropped.
 */
export function collapseMode(theme: Theme, keep: Mode): Theme {
  return {
    ...theme,
    modeStrategy: keep,
    schemes: theme.schemes.map((s) => {
      const map = roleMapFor(s, keep);
      return { ...s, light: keep === "light" ? map : undefined, dark: keep === "dark" ? map : undefined };
    }),
  };
}

/**
 * Expands a single-mode theme to dual by seeding the missing mode with a copy
 * of the existing mappings — a starting point for a visual designer, not a
 * finished dark theme (the doctor will say so).
 */
export function expandToDual(theme: Theme): Theme {
  if (theme.modeStrategy === "dual") return theme;
  const from = theme.modeStrategy;
  return {
    ...theme,
    modeStrategy: "dual",
    schemes: theme.schemes.map((s) => ({
      ...s,
      light: s.light ?? s[from],
      dark: s.dark ?? s[from],
    })),
  };
}

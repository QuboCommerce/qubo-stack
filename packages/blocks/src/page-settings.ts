import type { Effect, Theme, Transition } from "@qubo/stylekit";

/**
 * Per-page overrides of the theme's motion, stored on the document root
 * (`root.props`). "" follows the theme, "none" switches it off for this page,
 * anything else is a preset id from the theme. Pure functions: the storefront,
 * the studio and the browser runtime all resolve a page the same way.
 */
export type PageSettings = { transition?: string; effect?: string };

export const PAGE_NONE = "none";

export function pageSettings(rootProps: unknown): PageSettings {
  const p = (rootProps ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { transition: str(p.transition), effect: str(p.effect) };
}

/**
 * The transition id that plays when a visitor leaves this page: "" for none,
 * "native" for the browser crossfade, otherwise an overlay preset id.
 */
export function pageTransitionId(theme: Pick<Theme, "motion"> | undefined, page: PageSettings = {}): string {
  if (!theme || theme.motion.profile === "none") return "";
  const chosen = page.transition;
  if (chosen === PAGE_NONE) return "";
  if (chosen && theme.motion.transitions.some((t) => t.id === chosen)) return chosen;
  return theme.motion.transition;
}

/** The overlay preset this page leaves through, or null (none or native). */
export function pageOverlay(theme: Pick<Theme, "motion"> | undefined, page: PageSettings = {}): Transition | null {
  const id = pageTransitionId(theme, page);
  if (!id || id === "native") return null;
  return theme!.motion.transitions.find((t) => t.id === id) ?? null;
}

/**
 * Whether the theme's native crossfade has to be switched off on this page: a
 * page that picks an overlay or "none" must not also crossfade.
 */
export function pageBlocksNative(theme: Pick<Theme, "motion"> | undefined, page: PageSettings = {}): boolean {
  if (!theme || theme.motion.transition !== "native" || theme.motion.profile === "none") return false;
  return pageTransitionId(theme, page) !== "native";
}

/**
 * The site-wide effect for this page. A page that picks a preset gets it all
 * year; only the theme default follows the theme's schedule.
 */
export function pageEffect(theme: Pick<Theme, "effects"> | undefined, page: PageSettings = {}): { effect: Effect; schedule?: string } | null {
  if (!theme) return null;
  const fx = theme.effects;
  const chosen = page.effect;
  if (chosen === PAGE_NONE) return null;
  if (chosen) {
    const effect = fx.presets.find((e) => e.id === chosen);
    if (effect) return { effect };
  }
  const effect = fx.active ? fx.presets.find((e) => e.id === fx.active) : undefined;
  if (!effect) return null;
  return { effect, schedule: fx.schedule.enabled ? `${fx.schedule.from}..${fx.schedule.to}` : undefined };
}

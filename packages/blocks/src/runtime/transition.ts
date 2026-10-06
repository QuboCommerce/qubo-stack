import { easingPresets, paintExpression, roleVar, type Role, type Theme, type Transition } from "@qubo/stylekit";

/**
 * Page transition overlay. One implementation for the studio "Test" button
 * and the storefront island: build the element, cover, hold, uncover.
 * Styling lives in base.ts (`.qb-transition`); motion is WAAPI so the hold
 * time is exact and never fights CSS transitions.
 */

const ink: Partial<Record<Role, Role>> = { primary: "onPrimary", accent: "onAccent", secondary: "onSecondary", surface: "onSurface" };

type Frames = { cover: Keyframe[]; uncover: Keyframe[] };

function framesFor(move: Transition["move"], origin: string): Frames {
  switch (move) {
    case "slide-up":
      return { cover: [{ transform: "translate3d(0,100%,0)" }, { transform: "none" }], uncover: [{ transform: "none" }, { transform: "translate3d(0,-100%,0)" }] };
    case "slide-down":
      return { cover: [{ transform: "translate3d(0,-100%,0)" }, { transform: "none" }], uncover: [{ transform: "none" }, { transform: "translate3d(0,100%,0)" }] };
    case "wipe":
      return { cover: [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], uncover: [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }] };
    case "circle":
      return {
        cover: [{ clipPath: `circle(0% at ${origin})` }, { clipPath: `circle(150% at ${origin})` }],
        uncover: [{ clipPath: `circle(150% at ${origin})` }, { clipPath: `circle(0% at ${origin})` }],
      };
    default:
      return { cover: [{ opacity: 0 }, { opacity: 1 }], uncover: [{ opacity: 1 }, { opacity: 0 }] };
  }
}

/** A preset name from `easingPresets`, any CSS easing, or "" for the theme curve. */
export function resolveEasing(value: string, theme?: Pick<Theme, "motion">): string {
  if (!value) return theme?.motion.easing ?? easingPresets.standard;
  return (easingPresets as Record<string, string>)[value] ?? value;
}

export type TransitionOptions = {
  theme: Theme;
  /** `fixed` covers the viewport (storefront); `contained` fills the host (studio preview). */
  scope?: "fixed" | "contained";
  /** Circle origin in px relative to the host, e.g. the clicked link. */
  origin?: { x: number; y: number };
  /** Start fully covered (the arriving page, before first paint). */
  covered?: boolean;
  reduced?: boolean;
};

export type TransitionRun = {
  el: HTMLElement;
  cover: () => Promise<void>;
  uncover: () => Promise<void>;
  remove: () => void;
};

function iconUrl(t: Transition, theme: Theme): string | null {
  const b = theme.brand;
  if (t.icon === "logo") return b.logo?.url || b.mark?.url || null;
  if (t.icon === "mark") return b.mark?.url || b.favicon?.url || b.logo?.url || null;
  return null;
}

function buildOverlay(doc: Document, t: Transition, o: TransitionOptions): HTMLElement {
  const el = doc.createElement("div");
  el.className = "qb-transition";
  el.dataset.transition = t.id;
  el.dataset.transitionBg = t.background;
  el.dataset.scope = o.scope ?? "fixed";
  el.setAttribute("aria-hidden", "true");
  el.style.setProperty("--qb-transition-color", paintExpression(t.color));
  el.style.setProperty("--qb-transition-ink", `var(${roleVar(ink[t.color.role] ?? "text")})`);
  el.style.setProperty("--qb-transition-blur", `${t.blur}px`);
  if (t.icon !== "none") {
    const wrap = doc.createElement("div");
    wrap.className = "qb-transition-icon";
    wrap.dataset.motion = t.iconMotion;
    wrap.style.setProperty("--qb-icon-scale", String(t.iconScale));
    wrap.style.setProperty("--qb-icon-rotate", `${t.iconRotation}deg`);
    const url = iconUrl(t, o.theme);
    const inner = doc.createElement(url ? "img" : "span");
    inner.className = url ? "qb-transition-mark" : "qb-transition-dot";
    if (url) {
      (inner as HTMLImageElement).src = url;
      (inner as HTMLImageElement).alt = "";
      (inner as HTMLImageElement).decoding = "async";
    }
    wrap.append(inner);
    if (t.iconMotion === "line") wrap.append(Object.assign(doc.createElement("span"), { className: "qb-transition-line" }));
    if (t.iconMotion === "dots") {
      const dots = Object.assign(doc.createElement("span"), { className: "qb-transition-dots" });
      for (let i = 0; i < 3; i++) dots.append(doc.createElement("span"));
      wrap.append(dots);
    }
    el.append(wrap);
  }
  return el;
}

export function createTransition(host: HTMLElement, t: Transition, o: TransitionOptions): TransitionRun {
  const el = buildOverlay(host.ownerDocument, t, o);
  const origin = o.origin ? `${Math.round(o.origin.x)}px ${Math.round(o.origin.y)}px` : "50% 50%";
  const frames = o.reduced ? framesFor("fade", origin) : framesFor(t.move, origin);
  const easing = resolveEasing(t.easing, o.theme);
  const last = (f: Keyframe[]) => f[f.length - 1]!;
  if (o.covered) Object.assign(el.style, last(frames.cover));
  else Object.assign(el.style, frames.cover[0]);
  host.append(el);

  const play = async (keyframes: Keyframe[], duration: number) => {
    const a = el.animate(keyframes, { duration: o.reduced ? Math.min(duration, 120) : duration, easing, fill: "forwards" });
    await a.finished.catch(() => undefined);
    Object.assign(el.style, last(keyframes));
    a.cancel();
  };

  return {
    el,
    cover: () => play(frames.cover, t.durationIn),
    uncover: () => play(frames.uncover, t.durationOut),
    remove: () => el.remove(),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cover, hold for `minVisible` (at least `hold`), uncover, clean up. */
export async function previewTransition(host: HTMLElement, t: Transition, o: TransitionOptions & { hold?: number }): Promise<void> {
  const run = createTransition(host, t, o);
  try {
    await run.cover();
    await sleep(Math.max(t.minVisible, o.hold ?? 0));
    await run.uncover();
  } finally {
    run.remove();
  }
}

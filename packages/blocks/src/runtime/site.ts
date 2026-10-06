import type { Theme, Transition } from "@qubo/stylekit";
import { inSchedule, startEffects } from "./effects";
import { startMedia } from "./media";
import { startNav } from "./nav";
import { createTransition, type TransitionRun, type TransitionTheme } from "./transition";
import { pageTransitionId, type PageSettings } from "../page-settings";

/**
 * Everything a rendered site needs in the browser, framework free: ambient
 * effects, decor marks that wait until they scroll into view, header menus,
 * ambient videos that only play on screen and overlay page transitions across
 * full page loads. The storefront mounts it once per page.
 */

export const ARRIVAL_KEY = "qb-transition";
/** Departure records older than this are ignored (a slow or abandoned navigation). */
const ARRIVAL_TTL = 8000;
/** The arriving page never stays covered longer than this, even if `load` is slow. */
const MAX_HOLD = 2500;

export type ArrivalRecord = { id: string; t: number; color: string; image: string; blur: number };

/** The overlay preset a theme uses between pages, or null for none / native View Transitions. */
export function overlayTransition(theme: Pick<Theme, "motion"> | undefined): Transition | null {
  if (!theme || theme.motion.profile === "none") return null;
  const id = theme.motion.transition;
  if (!id || id === "native") return null;
  return theme.motion.transitions.find((t) => t.id === id) ?? null;
}

const clean = (v: string) => v.replace(/[;{}<>\\]/g, "");

/**
 * Inline script for the top of `<body>`: when the previous page left through
 * an overlay, paint the same colour before anything else so the new page never
 * flashes. The runtime swaps it for the real overlay and uncovers. A CSS
 * fallback fades it out on its own if the runtime never loads.
 */
export function arrivalScript(): string {
  return `(function(){try{var r=sessionStorage.getItem(${JSON.stringify(ARRIVAL_KEY)});if(!r)return;var d=JSON.parse(r);if(Date.now()-d.t>${ARRIVAL_TTL}){sessionStorage.removeItem(${JSON.stringify(ARRIVAL_KEY)});return}var c=function(v){return String(v||"").replace(/[;{}<>\\\\]/g,"")};var s=document.createElement("style");s.id="qb-arrival";s.textContent="html[data-qb-arriving]::after{content:'';position:fixed;inset:0;z-index:2147483000;background-color:"+c(d.color)+";background-image:"+(c(d.image)||"none")+";"+(d.blur?"-webkit-backdrop-filter:blur("+(+d.blur)+"px);backdrop-filter:blur("+(+d.blur)+"px);":"")+"animation:qb-arrival-out .3s ease ${MAX_HOLD + 1500}ms forwards}@keyframes qb-arrival-out{to{opacity:0;visibility:hidden}}";document.head.appendChild(s);document.documentElement.setAttribute("data-qb-arriving",d.id)}catch(e){}})();`;
}

function themeHost(doc: Document): HTMLElement {
  return doc.querySelector<HTMLElement>("[data-theme]") ?? doc.body;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

function loaded(win: Window): Promise<void> {
  if (win.document.readyState === "complete") return Promise.resolve();
  return new Promise((r) => win.addEventListener("load", () => r(), { once: true }));
}

function navigable(a: HTMLAnchorElement, e: MouseEvent, win: Window): URL | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if (a.hasAttribute("download") || a.closest("[data-qb-no-transition]")) return null;
  const target = a.getAttribute("target");
  if (target && target !== "_self") return null;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return null;
  const url = new URL(a.href, win.location.href);
  if (url.origin !== win.location.origin) return null;
  // Same page with only a different hash scrolls; no transition.
  if (url.pathname === win.location.pathname && url.search === win.location.search) return null;
  if (url.pathname.startsWith("/api/")) return null;
  return url;
}

/**
 * `t` is the overlay this page leaves through (null: links navigate plainly).
 * Arrival always plays the preset the previous page left through, so a page
 * with its own transition, or none, still uncovers cleanly.
 */
function startTransitions(win: Window, theme: TransitionTheme, t: Transition | null, reduced: boolean): () => void {
  const doc = win.document;
  const html = doc.documentElement;
  let leaving: TransitionRun | null = null;

  // Arrival: swap the pre-paint cover for the real overlay, wait, uncover.
  const arrivingId = html.getAttribute("data-qb-arriving");
  if (arrivingId) {
    let record: ArrivalRecord | null = null;
    try {
      record = JSON.parse(win.sessionStorage.getItem(ARRIVAL_KEY) ?? "null");
    } catch {}
    win.sessionStorage.removeItem(ARRIVAL_KEY);
    html.removeAttribute("data-qb-arriving");
    doc.getElementById("qb-arrival")?.remove();
    const came = theme.motion.transitions.find((x) => x.id === arrivingId) ?? t;
    if (came) {
      const run = createTransition(themeHost(doc), came, { theme, covered: true, reduced });
      const since = record?.t ?? Date.now();
      void Promise.race([Promise.all([loaded(win), sleep(since + came.minVisible - Date.now())]), sleep(MAX_HOLD)])
        .then(() => run.uncover())
        .then(() => run.remove());
    }
  }
  if (!t) return () => {};

  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const url = navigable(a, e, win);
    if (!url) return;
    e.preventDefault();
    if (leaving) return;
    const run = createTransition(themeHost(doc), t, { theme, origin: { x: e.clientX, y: e.clientY }, reduced });
    leaving = run;
    void run.cover().then(() => {
      const cs = win.getComputedStyle(run.el);
      const record: ArrivalRecord = { id: t.id, t: Date.now(), color: clean(cs.backgroundColor), image: clean(cs.backgroundImage === "none" ? "" : cs.backgroundImage), blur: t.background === "translucent" ? t.blur : 0 };
      try {
        win.sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(record));
      } catch {}
      win.location.assign(url.href);
    });
  };

  // Back/forward cache restores the page with the overlay still up.
  const onShow = (e: PageTransitionEvent) => {
    if (!e.persisted || !leaving) return;
    const run = leaving;
    leaving = null;
    win.sessionStorage.removeItem(ARRIVAL_KEY);
    void run.uncover().then(() => run.remove());
  };

  doc.addEventListener("click", onClick);
  win.addEventListener("pageshow", onShow);
  return () => {
    doc.removeEventListener("click", onClick);
    win.removeEventListener("pageshow", onShow);
    leaving?.remove();
  };
}

/** Pauses below-the-fold decor draw-ins until the heading scrolls into view. */
function startDecor(doc: Document): () => void {
  const win = doc.defaultView;
  if (!win || !("IntersectionObserver" in win)) return () => {};
  const els = Array.from(doc.querySelectorAll<HTMLElement>('[data-decor-animate="true"]'));
  const below = els.filter((el) => el.getBoundingClientRect().top > win.innerHeight);
  if (!below.length) return () => {};
  const anims = new Map<Element, Animation[]>();
  for (const el of below) {
    const list = el.getAnimations({ subtree: true });
    list.forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    anims.set(el, list);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        anims.get(e.target)?.forEach((a) => a.play());
        anims.delete(e.target);
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -15% 0px" },
  );
  below.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/**
 * The theme slice the browser needs, with `motion.transition` resolved for this
 * page. Every overlay preset stays: the previous page may have left through
 * any of them. No palette or schemes.
 */
export function runtimeTheme(theme: Theme | undefined, page?: PageSettings): TransitionTheme | undefined {
  if (!theme) return undefined;
  const transitions = theme.motion.profile === "none" ? [] : theme.motion.transitions;
  return { brand: theme.brand, motion: { ...theme.motion, transition: pageTransitionId(theme, page), transitions } };
}

/** Whether pages of this theme can arrive under an overlay (theme default or any page's pick). */
export function mayArriveCovered(theme: Pick<Theme, "motion"> | undefined): boolean {
  return Boolean(theme && theme.motion.profile !== "none" && theme.motion.transitions.length);
}

export function startSiteRuntime(win: Window, theme: TransitionTheme | undefined): () => void {
  const doc = win.document;
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stops: (() => void)[] = [startNav(doc), startMedia(doc)];

  // A scheduled site-wide effect is rendered hidden; switch it on inside its window.
  doc.querySelectorAll<HTMLElement>('[data-effect-scope="page"][data-effect-schedule]').forEach((el) => {
    const [from = "", to = ""] = (el.dataset.effectSchedule ?? "").split("..");
    if (inSchedule({ enabled: true, from, to })) el.dataset.effectLive = "true";
    else el.remove();
  });
  const fx = startEffects(doc, { reduced });
  stops.push(() => fx.stop());
  if (!reduced) stops.push(startDecor(doc));

  const t = overlayTransition(theme);
  if (theme && (t || doc.documentElement.hasAttribute("data-qb-arriving"))) stops.push(startTransitions(win, theme, t, reduced));
  else {
    doc.documentElement.removeAttribute("data-qb-arriving");
    doc.getElementById("qb-arrival")?.remove();
  }

  return () => stops.forEach((s) => s());
}

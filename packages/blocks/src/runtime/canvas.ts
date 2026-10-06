import { startEffect, type EffectHandle } from "./effects";
import { startMedia } from "./media";
import { startNav } from "./nav";

/**
 * The site runtime for the studio canvas. The canvas re-renders on every edit,
 * so instead of one pass it follows the DOM: effects start and stop as their
 * elements come and go (a running snowfall is not restarted by an unrelated
 * edit), and header menus and ambient videos are re-bound after changes
 * settle. Page transitions are not bound to clicks (links do not navigate in
 * the editor); the studio plays them on demand with `previewTransition`.
 * Scheduled page effects show all year here, so they can be designed.
 */
export function startCanvasRuntime(doc: Document): () => void {
  const win = doc.defaultView;
  if (!win) return () => {};
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  const effects = new Map<HTMLElement, { kind: string; handle: EffectHandle }>();
  let binds: (() => void)[] = [];
  let timer = 0;

  const syncEffects = () => {
    const live = new Set(doc.querySelectorAll<HTMLElement>("[data-effect-kind]"));
    for (const [el, fx] of effects) {
      if (!live.has(el) || !el.isConnected || el.dataset.effectKind !== fx.kind) {
        fx.handle.stop();
        effects.delete(el);
      }
    }
    for (const el of live) {
      if (el.dataset.effectScope === "page" && el.dataset.effectSchedule) el.dataset.effectLive = "true";
      if (effects.has(el)) continue;
      effects.set(el, { kind: el.dataset.effectKind ?? "", handle: startEffect(el, { reduced: motion.matches }) });
    }
  };

  const rebind = () => {
    binds.forEach((stop) => stop());
    binds = [startNav(doc), startMedia(doc)];
  };

  const refresh = () => {
    timer = 0;
    syncEffects();
    rebind();
  };

  // Our own writes (effect canvases) must not wake the observer again.
  const ours = (n: Node) => (n instanceof win.HTMLElement ? n.closest(".qb-effect") !== null || n.classList.contains("qb-effect-canvas") : false);
  const mo = new win.MutationObserver((records) => {
    if (records.every((r) => ours(r.target) && r.type === "childList")) return;
    if (!timer) timer = win.setTimeout(refresh, 120);
  });
  mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-effect-kind", "data-effect"] });
  const onMotion = () => {
    for (const fx of effects.values()) fx.handle.stop();
    effects.clear();
    refresh();
  };
  motion.addEventListener?.("change", onMotion);
  refresh();

  return () => {
    mo.disconnect();
    if (timer) win.clearTimeout(timer);
    motion.removeEventListener?.("change", onMotion);
    binds.forEach((stop) => stop());
    for (const fx of effects.values()) fx.handle.stop();
    effects.clear();
  };
}

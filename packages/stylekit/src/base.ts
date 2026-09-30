import { CSS_PREFIX as p } from "./compile";

/**
 * Theme-independent CSS that consumes the variables emitted by compileTheme.
 * Shipped once per storefront (and into the Studio canvas). Block-specific
 * layout CSS lives in @peltier/blocks (blockCss); nothing here depends on a theme.
 */
export const baseCss = /* css */ `
:where([data-theme]) {
  font-family: var(--${p}-font-body);
  font-weight: var(--${p}-font-body-weight);
  letter-spacing: var(--${p}-font-body-tracking);
  line-height: var(--${p}-font-body-leading);
  font-size: var(--${p}-step-0);
  -webkit-font-smoothing: antialiased;
}
:where([data-theme]) *, :where([data-theme]) *::before, :where([data-theme]) *::after {
  border-color: var(--${p}-border);
}

/* ---- typography roles -------------------------------------------------- */
.${p}-font-display, .${p}-font-heading, .${p}-font-body, .${p}-font-accent, .${p}-font-mono {
  font-family: var(--${p}-font-role);
  font-weight: var(--${p}-font-role-weight);
  letter-spacing: var(--${p}-font-role-tracking);
  line-height: var(--${p}-font-role-leading);
  text-transform: var(--${p}-font-role-case);
}
${["display", "heading", "body", "accent", "mono"]
  .map(
    (r) => `.${p}-font-${r} {
  --${p}-font-role: var(--${p}-font-${r});
  --${p}-font-role-weight: var(--${p}-font-${r}-weight);
  --${p}-font-role-tracking: var(--${p}-font-${r}-tracking);
  --${p}-font-role-leading: var(--${p}-font-${r}-leading);
  --${p}-font-role-case: var(--${p}-font-${r}-case);
}`,
  )
  .join("\n")}
.${p}-heading { color: var(--${p}-heading); text-wrap: balance; margin: 0; }
.${p}-muted { color: var(--${p}-text-muted); }
.${p}-accent-text { color: var(--${p}-accent-text); }
.${p}-prose { max-width: 70ch; text-wrap: pretty; }
.${p}-prose > * + * { margin-top: 0.9em; }
.${p}-prose a, a.${p}-link { color: var(--${p}-link); text-underline-offset: 0.2em; }
.${p}-prose h2, .${p}-prose h3 { font-family: var(--${p}-font-heading); color: var(--${p}-heading); }
.${p}-prose ul { list-style: disc; padding-left: 1.25em; }
.${p}-prose ol { list-style: decimal; padding-left: 1.25em; }

/* ---- surfaces ---------------------------------------------------------- */
.${p}-surface {
  background-color: var(--${p}-surface);
  color: var(--${p}-on-surface);
  border-radius: var(--${p}-radius-lg);
}
.${p}-bordered { border: var(--${p}-border-width) solid var(--${p}-border); }

/* ---- buttons ----------------------------------------------------------- */
.${p}-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5em;
  padding: var(--${p}-btn-py) var(--${p}-btn-px);
  border-radius: var(--${p}-btn-radius);
  border: var(--${p}-btn-border-width) solid var(--${p}-btn-border, transparent);
  box-shadow: var(--${p}-btn-shadow);
  font-family: var(--${p}-btn-font);
  font-weight: var(--${p}-btn-weight);
  text-transform: var(--${p}-btn-case);
  letter-spacing: var(--${p}-btn-tracking);
  font-size: var(--${p}-step-0);
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  background: var(--${p}-btn-bg, var(--${p}-primary));
  color: var(--${p}-btn-fg, var(--${p}-on-primary));
  transition: transform var(--${p}-duration-fast) var(--${p}-ease),
    filter var(--${p}-duration-fast) var(--${p}-ease),
    box-shadow var(--${p}-duration-fast) var(--${p}-ease),
    background-color var(--${p}-duration-fast) var(--${p}-ease);
}
.${p}-button:hover {
  transform: var(--${p}-btn-hover-transform);
  filter: var(--${p}-btn-hover-filter);
  box-shadow: var(--${p}-btn-hover-shadow);
}
.${p}-button:focus-visible { outline: 2px solid var(--${p}-focus-ring); outline-offset: 2px; }
.${p}-button[data-emphasis="primary"] { --${p}-btn-bg: var(--${p}-primary); --${p}-btn-fg: var(--${p}-on-primary); --${p}-btn-border: var(--${p}-primary); }
.${p}-button[data-emphasis="secondary"] { --${p}-btn-bg: var(--${p}-secondary); --${p}-btn-fg: var(--${p}-on-secondary); --${p}-btn-border: var(--${p}-secondary); }
.${p}-button[data-emphasis="outline"] { --${p}-btn-bg: transparent; --${p}-btn-fg: var(--${p}-text); --${p}-btn-border: currentColor; border-width: max(1px, var(--${p}-btn-border-width)); }
.${p}-button[data-emphasis="ghost"] { --${p}-btn-bg: transparent; --${p}-btn-fg: var(--${p}-text); box-shadow: none; }
.${p}-button[data-emphasis="link"] { --${p}-btn-bg: transparent; --${p}-btn-fg: var(--${p}-link); padding-inline: 0; box-shadow: none; text-decoration: underline; text-underline-offset: 0.25em; }

/* ---- section chrome ---------------------------------------------------- */
.${p}-section {
  position: relative;
  padding-top: var(--${p}-section-pt, var(--${p}-gap-xl));
  padding-bottom: var(--${p}-section-pb, var(--${p}-gap-xl));
  isolation: isolate;
}
.${p}-container {
  width: 100%;
  margin-inline: auto;
  padding-inline: var(--${p}-gap-sm);
  max-width: var(--${p}-container, 72rem);
}
.${p}-section[data-width="narrow"] { --${p}-container: 44rem; }
.${p}-section[data-width="content"] { --${p}-container: 72rem; }
.${p}-section[data-width="wide"] { --${p}-container: 88rem; }
.${p}-section[data-width="full"] { --${p}-container: none; }
.${p}-section[data-width="full"] > .${p}-container { padding-inline: 0; }
.${p}-section-bg { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
.${p}-section-bg > img, .${p}-section-bg > video { width: 100%; height: 100%; object-fit: cover; }
.${p}-section-art { position: absolute; pointer-events: none; z-index: -1; }
.${p}-edge { position: absolute; left: 0; width: 100%; height: var(--${p}-edge-height, 48px); color: var(--${p}-background); pointer-events: none; }
.${p}-edge[data-edge-side="top"] { bottom: calc(100% - 1px); transform: scaleY(-1); }
.${p}-edge[data-edge-side="bottom"] { top: calc(100% - 1px); }
.${p}-section[data-edges] { z-index: 1; }
.${p}-section[data-scheme], .${p}-section:has(> .${p}-edge) { background-color: var(--${p}-background); }
@media (max-width: 767px) { [data-hide-mobile="true"] { display: none !important; } }
@media (min-width: 768px) and (max-width: 1023px) { [data-hide-tablet="true"] { display: none !important; } }
@media (min-width: 1024px) { [data-hide-desktop="true"] { display: none !important; } }

/* ---- motion ------------------------------------------------------------ */
@keyframes ${p}-fade { from { opacity: 0; } }
@keyframes ${p}-rise { from { opacity: 0; transform: translateY(var(--${p}-entrance-distance)); } }
@keyframes ${p}-scale { from { opacity: 0; transform: scale(0.96); } }
@keyframes ${p}-blur { from { opacity: 0; filter: blur(8px); } }
@supports (animation-timeline: view()) {
  [data-entrance]:not([data-entrance="none"]) {
    animation: var(--${p}-entrance-name) linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
  }
}
[data-entrance="fade"] { --${p}-entrance-name: ${p}-fade; }
[data-entrance="rise"] { --${p}-entrance-name: ${p}-rise; }
[data-entrance="scale"] { --${p}-entrance-name: ${p}-scale; }
[data-entrance="blur"] { --${p}-entrance-name: ${p}-blur; }
@media (prefers-reduced-motion: reduce) {
  [data-entrance] { animation: none !important; }
  .${p}-button { transition: none; }
}
`;

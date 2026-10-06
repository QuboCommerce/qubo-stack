/**
 * Static CSS for the block library. Theme-independent: consumes `--qb-*`
 * variables from compileTheme. Blocks ship their own CSS (instead of relying
 * on the host's Tailwind) so they render identically in the Studio iframe,
 * any storefront and future client sites without `@source` scanning.
 * Responsive values travel as CSS variables set inline (`--qb-cols-md`…).
 */
export const blockCss = /* css */ `
.qb-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.qb-small { font-size: var(--qb-step-n1); }
.qb-intro { font-size: var(--qb-step-1); max-width: 60ch; margin: 0; text-wrap: pretty; }
.qb-empty {
  display: grid; place-items: center; padding: 1rem; text-align: center;
  font: 500 13px/1.3 ui-sans-serif, system-ui, sans-serif; color: var(--qb-text-muted);
  border: 1.5px dashed color-mix(in oklab, var(--qb-text) 25%, transparent);
  border-radius: var(--qb-radius-md);
  background: color-mix(in oklab, var(--qb-text) 4%, transparent);
}
.qb-media-placeholder { display: block; aspect-ratio: var(--qb-media-aspect, 1/1); border-radius: var(--qb-radius-md); background: color-mix(in oklab, var(--qb-text) 8%, transparent); }
[data-theme] img, [data-theme] video { max-width: 100%; display: block; }
[data-theme] :where(h1, h2, h3, h4, p, figure, blockquote, ul, ol) { margin: 0; }

/* ---- layout ------------------------------------------------------------ */
.qb-stack { display: flex; flex-direction: var(--qb-dir, column); min-width: 0; }
.qb-grid { display: grid; grid-template-columns: repeat(var(--qb-cols, 1), minmax(0, 1fr)); list-style: none; padding: 0; }
@media (min-width: 768px) {
  .qb-stack { flex-direction: var(--qb-dir-md, var(--qb-dir, column)); }
  .qb-grid { grid-template-columns: repeat(var(--qb-cols-md, var(--qb-cols, 1)), minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .qb-stack { flex-direction: var(--qb-dir-lg, var(--qb-dir-md, var(--qb-dir, column))); }
  .qb-grid { grid-template-columns: repeat(var(--qb-cols-lg, var(--qb-cols-md, var(--qb-cols, 1))), minmax(0, 1fr)); }
}
.qb-columns { display: grid; grid-template-columns: minmax(0, 1fr); }
.qb-column { display: flex; flex-direction: column; gap: var(--qb-gap-sm); min-width: 0; }
@media (max-width: 767px) { .qb-columns[data-reverse-mobile] > :first-child { order: 2; } }
@media (min-width: 768px) { .qb-columns { grid-template-columns: var(--qb-col-a) var(--qb-col-b); } }
.qb-box { padding: var(--qb-box-p); background: var(--qb-background); color: var(--qb-text); }
.qb-box[data-border] { border: var(--qb-border-width) solid var(--qb-border); }
@media (min-width: 768px) { .qb-box { padding: var(--qb-box-p-md, var(--qb-box-p)); } }
@media (min-width: 1024px) { .qb-box { padding: var(--qb-box-p-lg, var(--qb-box-p-md, var(--qb-box-p))); } }
.qb-spacer { height: var(--qb-spacer); }
@media (min-width: 768px) { .qb-spacer { height: var(--qb-spacer-md, var(--qb-spacer)); } }
@media (min-width: 1024px) { .qb-spacer { height: var(--qb-spacer-lg, var(--qb-spacer-md, var(--qb-spacer))); } }
.qb-divider { border: 0; border-top: var(--qb-border-width, 1px) solid var(--qb-border); width: 100%; }
.qb-divider[data-style="dashed"] { border-top-style: dashed; }
.qb-divider[data-style="dotted"] { border-top-style: dotted; border-top-width: 2px; }
.qb-divider[data-style="accent"] { width: 4rem; border-top: 3px solid var(--qb-accent-text); border-radius: 2px; }
.qb-divider[data-style="wave"] {
  border: 0; height: 12px; background: var(--qb-border);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='12'%3E%3Cpath d='M0 6 Q6 0 12 6 T24 6' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") repeat-x center / 24px 12px;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='12'%3E%3Cpath d='M0 6 Q6 0 12 6 T24 6' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") repeat-x center / 24px 12px;
}
.qb-rail {
  display: grid; grid-auto-flow: column; list-style: none; padding: 0 0 var(--qb-gap-xs);
  grid-auto-columns: calc((100% - (var(--qb-cols, 1) - 1) * var(--qb-gap-md)) / var(--qb-cols, 1) * 0.9);
  overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: thin;
}
.qb-rail > * { scroll-snap-align: start; }
@media (min-width: 768px) { .qb-rail { grid-auto-columns: calc((100% - (var(--qb-cols-md, 2) - 1) * var(--qb-gap-md)) / var(--qb-cols-md, 2)); } }
@media (min-width: 1024px) { .qb-rail { grid-auto-columns: calc((100% - (var(--qb-cols-lg, 3) - 1) * var(--qb-gap-md)) / var(--qb-cols-lg, 3)); } }

/* ---- elements ---------------------------------------------------------- */
.qb-eyebrow { color: var(--qb-accent-text); font-size: var(--qb-step-n1); letter-spacing: 0.08em; text-transform: uppercase; }
.qb-eyebrow > span { display: inline-flex; align-items: center; gap: 0.4em; }
.qb-eyebrow[data-look="pill"] > span {
  padding: 0.35em 0.9em; border-radius: var(--qb-radius-full);
  background: color-mix(in oklab, var(--qb-accent-text) 12%, transparent);
}
.qb-button[data-size="sm"] { font-size: var(--qb-step-n1); padding: calc(var(--qb-btn-py) * 0.7) calc(var(--qb-btn-px) * 0.75); }
.qb-button[data-size="lg"] { font-size: var(--qb-step-1); padding: calc(var(--qb-btn-py) * 1.25) calc(var(--qb-btn-px) * 1.25); }
.qb-button-group { display: flex; flex-wrap: wrap; align-items: center; }
@media (max-width: 767px) { .qb-stack-mobile { flex-direction: column; align-items: stretch; } .qb-stack-mobile .qb-button { width: 100%; } }
.qb-figure { display: flex; flex-direction: column; gap: var(--qb-gap-2xs); }
.qb-figure figcaption { font-size: var(--qb-step-n1); }
.qb-image, .qb-video { width: 100%; height: auto; }
.qb-video, .qb-embed { width: 100%; border: 0; object-fit: cover; }
.qb-icon { display: inline-grid; place-items: center; line-height: 1; flex: none; }
.qb-icon[data-size="sm"] { font-size: var(--qb-step-0); }
.qb-icon[data-size="md"] { font-size: var(--qb-step-2); }
.qb-icon[data-size="lg"] { font-size: var(--qb-step-4); }
.qb-icon[data-size="xl"] { font-size: var(--qb-step-6); }
.qb-icon[data-tone="primary"] { color: var(--qb-primary); }
.qb-icon[data-tone="accent"] { color: var(--qb-accent-text); }
.qb-icon[data-tone="muted"] { color: var(--qb-text-muted); }
.qb-icon[data-framed] { width: 2.2em; height: 2.2em; font-size: calc(var(--qb-step-2) * 0.8); border-radius: var(--qb-radius-lg); background: color-mix(in oklab, currentColor 12%, transparent); }
.qb-badge {
  display: inline-flex; align-items: center; width: fit-content; gap: 0.3em;
  padding: 0.2em 0.65em; border-radius: var(--qb-radius-full); font-size: var(--qb-step-n2); line-height: 1.4;
  background: var(--qb-accent); color: var(--qb-on-accent);
}
.qb-badge[data-tone="primary"] { background: var(--qb-primary); color: var(--qb-on-primary); }
.qb-badge[data-tone="neutral"] { background: var(--qb-surface); color: var(--qb-on-surface); }
.qb-badge[data-tone="outline"] { background: transparent; color: var(--qb-text); border: 1px solid currentColor; }
.qb-stat-value { font-size: var(--qb-step-5); line-height: 1; color: var(--qb-heading); }
.qb-stats[data-dividers] > * + * { border-inline-start: var(--qb-border-width, 1px) solid var(--qb-border); }
@media (max-width: 767px) { .qb-stats[data-dividers] > * + * { border-inline-start: 0; } }
.qb-price { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em; }
.qb-price strong { color: var(--qb-heading); }
.qb-price[data-size="sm"] strong { font-size: var(--qb-step-0); }
.qb-price[data-size="md"] strong { font-size: var(--qb-step-2); }
.qb-price[data-size="lg"] strong { font-size: var(--qb-step-4); }
.qb-list { display: flex; flex-direction: column; list-style: none; padding: 0; }
.qb-list li { display: flex; gap: 0.6em; align-items: flex-start; }
.qb-list-icon { color: var(--qb-primary); flex: none; margin-top: 0.2em; }
.qb-list[data-marker="bullet"] { list-style: disc; padding-left: 1.25em; }
.qb-list[data-marker="number"] { list-style: decimal; padding-left: 1.5em; }
.qb-list[data-marker="bullet"] li, .qb-list[data-marker="number"] li { display: list-item; }
.qb-logo { display: inline-flex; align-items: center; color: var(--qb-heading); text-decoration: none; font-size: var(--qb-step-2); }
.qb-logo img { height: var(--qb-logo-h, 2.5rem); width: auto; }
.qb-logo[data-size="sm"] { --qb-logo-h: 1.75rem; }
.qb-logo[data-size="lg"] { --qb-logo-h: 3.5rem; }
.qb-logo[data-size="xl"] { --qb-logo-h: 5rem; }
.qb-avatar-block { display: inline-flex; align-items: center; gap: 0.75em; }
.qb-avatar {
  width: var(--qb-avatar, 3rem); height: var(--qb-avatar, 3rem); border-radius: 9999px; object-fit: cover; flex: none;
  display: inline-grid; place-items: center; background: var(--qb-surface); color: var(--qb-on-surface); font-weight: 600;
}
.qb-avatar-block[data-size="sm"] { --qb-avatar: 2.25rem; }
.qb-avatar-block[data-size="lg"] { --qb-avatar: 4.5rem; }
.qb-quote { display: flex; flex-direction: column; gap: var(--qb-gap-sm); }
.qb-quote-text { font-size: var(--qb-step-1); font-family: var(--qb-font-heading); color: var(--qb-heading); text-wrap: pretty; }
.qb-quote[data-size="lg"] .qb-quote-text { font-size: var(--qb-step-3); }
.qb-quote-author { display: flex; align-items: center; gap: 0.75em; }
.qb-quote-author .qb-avatar { --qb-avatar: 2.75rem; }
.qb-rating { display: flex; gap: 0.15em; color: var(--qb-accent-text); }
.qb-card { position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--qb-radius-lg); height: 100%; }
.qb-card[data-look="surface"] { background: var(--qb-surface); color: var(--qb-on-surface); }
.qb-card[data-look="outline"] { border: var(--qb-border-width, 1px) solid var(--qb-border); }
.qb-card[data-look="plain"] { border-radius: 0; overflow: visible; }
.qb-card[data-look="plain"] .qb-card-media { border-radius: var(--qb-radius-lg); }
.qb-card-media { width: 100%; object-fit: cover; aspect-ratio: var(--qb-media-aspect, auto); }
.qb-card-body { display: flex; flex-direction: column; gap: var(--qb-gap-2xs); flex: 1; }
.qb-card-link { position: absolute; inset: 0; z-index: 1; }
.qb-card[data-linked] { transition: transform var(--qb-duration-base) var(--qb-ease), box-shadow var(--qb-duration-base) var(--qb-ease); }
.qb-card[data-linked]:hover { transform: translateY(-2px); }
.qb-card-link:focus-visible { outline: 2px solid var(--qb-focus-ring); outline-offset: 2px; border-radius: inherit; }

/* ---- section building blocks -------------------------------------------- */
.qb-section-header { display: flex; flex-direction: column; gap: var(--qb-gap-xs); margin-bottom: var(--qb-gap-lg); max-width: 48rem; }
.qb-section-header[data-align="center"] { text-align: center; align-items: center; margin-inline: auto; }
.qb-section-header .qb-button { margin-top: var(--qb-gap-2xs); align-self: flex-start; }
.qb-section-header[data-align="center"] .qb-button { align-self: center; }

.qb-hero { position: relative; display: grid; gap: var(--qb-gap-xl); align-items: center; }
.qb-hero-content { position: relative; z-index: 1; max-width: 44rem; }
.qb-hero-figure { position: relative; }
.qb-hero-media { width: 100%; aspect-ratio: var(--qb-media-aspect, auto); object-fit: cover; border-radius: var(--qb-media-radius); }
@media (min-width: 1024px) {
  .qb-hero[data-layout="split"] { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
  .qb-hero[data-layout="split"][data-media-position="start"] .qb-hero-figure { order: -1; }
}
.qb-hero[data-layout="typographic"] { justify-items: center; }
.qb-hero[data-layout="typographic"] .qb-hero-content { max-width: 56rem; }
.qb-hero[data-layout="stacked"] .qb-hero-content { margin-inline: auto; text-align: center; align-items: center; }
.qb-hero[data-layout="overlay"] { display: flex; flex-direction: column; padding: var(--qb-gap-lg); color: #fff; }
.qb-hero[data-layout="overlay"] .qb-heading, .qb-hero[data-layout="overlay"] .qb-muted, .qb-hero[data-layout="overlay"] .qb-eyebrow { color: inherit; }
.qb-hero-backdrop { position: absolute; inset: 0; overflow: hidden; border-radius: var(--qb-media-radius); }
.qb-section[data-width="full"] .qb-hero-backdrop { border-radius: 0; }
.qb-hero-backdrop .qb-hero-media { height: 100%; aspect-ratio: auto; border-radius: 0; }
.qb-hero-backdrop::after { content: ""; position: absolute; inset: 0; background: #000; opacity: var(--qb-overlay, 0.4); }

.qb-split { display: grid; gap: var(--qb-gap-xl); grid-template-columns: minmax(0, 1fr); }
.qb-split-media img, .qb-split-media video { width: 100%; aspect-ratio: var(--qb-media-aspect, auto); object-fit: cover; border-radius: var(--qb-media-radius); }
@media (min-width: 768px) {
  .qb-split { grid-template-columns: var(--qb-col-a) var(--qb-col-b); }
  .qb-split[data-media-position="end"] { grid-template-columns: var(--qb-col-b) var(--qb-col-a); }
  .qb-split[data-media-position="end"] .qb-split-media { order: 2; }
  .qb-split[data-bleed] .qb-split-media img { border-radius: 0; }
}
.qb-rich-text { max-width: 44rem; margin-inline: auto; }
.qb-cta-content { display: flex; flex-direction: column; gap: var(--qb-gap-sm); align-items: center; text-align: center; }
.qb-cta[data-panel] { padding: var(--qb-gap-xl) var(--qb-gap-lg); border-radius: var(--qb-radius-xl); }
@media (min-width: 768px) {
  .qb-cta[data-layout="row"] .qb-cta-content { flex-direction: row; justify-content: space-between; text-align: start; flex-wrap: wrap; }
}
.qb-slideshow { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.qb-slideshow::-webkit-scrollbar { display: none; }
.qb-slide {
  position: relative; flex: 0 0 100%; min-height: var(--qb-slide-h, 80vh); scroll-snap-align: start;
  display: flex; flex-direction: column; padding: var(--qb-gap-xl) var(--qb-gap-lg); color: #fff; isolation: isolate;
  background: color-mix(in oklab, var(--qb-text) 70%, transparent);
}
.qb-slide > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
.qb-slide::after { content: ""; position: absolute; inset: 0; background: #000; opacity: var(--qb-overlay, 0.35); z-index: -1; }
.qb-slide .qb-heading, .qb-slide .qb-eyebrow { color: inherit; }
.qb-slide-content { max-width: 40rem; }

.qb-feature { display: flex; flex-direction: column; gap: var(--qb-gap-xs); height: 100%; }
.qb-feature[data-look="card"] { background: var(--qb-surface); color: var(--qb-on-surface); padding: var(--qb-gap-md); border-radius: var(--qb-radius-lg); }
.qb-feature[data-look="outline"] { border: var(--qb-border-width, 1px) solid var(--qb-border); padding: var(--qb-gap-md); border-radius: var(--qb-radius-lg); }
.qb-feature-media { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--qb-radius-md); }
.qb-testimonial[data-look="card"] { background: var(--qb-surface); color: var(--qb-on-surface); padding: var(--qb-gap-md); border-radius: var(--qb-radius-lg); height: 100%; }

.qb-faq { display: grid; gap: var(--qb-gap-lg); }
@media (min-width: 1024px) { .qb-faq[data-layout="side"] { grid-template-columns: 2fr 3fr; align-items: start; } }
.qb-faq[data-layout="side"] .qb-section-header { margin-bottom: 0; }
.qb-faq-items { display: flex; flex-direction: column; max-width: 48rem; width: 100%; margin-inline: auto; }
.qb-faq-item { border-bottom: var(--qb-border-width, 1px) solid var(--qb-border); }
.qb-faq-item summary {
  display: flex; justify-content: space-between; align-items: center; gap: 1em; cursor: pointer; list-style: none;
  padding-block: var(--qb-gap-sm); font-weight: 600; color: var(--qb-heading);
}
.qb-faq-item summary::-webkit-details-marker { display: none; }
.qb-faq-icon { flex: none; transition: transform var(--qb-duration-fast) var(--qb-ease); }
.qb-faq-item[open] .qb-faq-icon { transform: rotate(45deg); }
.qb-faq-item > p { padding-bottom: var(--qb-gap-sm); }

.qb-marquee { display: flex; overflow: hidden; user-select: none; gap: 0; --qb-marquee-duration: 30s; }
.qb-marquee[data-speed="slow"] { --qb-marquee-duration: 50s; }
.qb-marquee[data-speed="fast"] { --qb-marquee-duration: 16s; }
.qb-marquee-run {
  display: flex; flex: none; min-width: 100%; justify-content: space-around; align-items: center; gap: var(--qb-gap-lg);
  padding-inline-end: var(--qb-gap-lg); list-style: none; margin: 0;
  animation: qb-marquee var(--qb-marquee-duration) linear infinite;
}
.qb-marquee[data-reverse] .qb-marquee-run { animation-direction: reverse; }
.qb-marquee:hover .qb-marquee-run { animation-play-state: paused; }
.qb-marquee-item { display: inline-flex; align-items: center; gap: var(--qb-gap-lg); white-space: nowrap; }
@keyframes qb-marquee { to { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) { .qb-marquee-run { animation: none; } .qb-marquee { flex-wrap: wrap; } }

.qb-logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--qb-gap-lg) var(--qb-gap-xl); list-style: none; padding: 0; }
.qb-logo-item img { height: var(--qb-logo-h, 2.5rem); width: auto; object-fit: contain; }
.qb-logos[data-size="sm"] { --qb-logo-h: 1.75rem; }
.qb-logos[data-size="lg"] { --qb-logo-h: 3.5rem; }
.qb-logos[data-mono] img { filter: grayscale(1); opacity: 0.7; transition: opacity var(--qb-duration-fast), filter var(--qb-duration-fast); }
.qb-logos[data-mono] li:hover img { filter: none; opacity: 1; }
.qb-logo-item > span { font-size: var(--qb-step-1); color: var(--qb-text-muted); }

.qb-gallery { list-style: none; padding: 0; }
.qb-gallery figure { display: flex; flex-direction: column; gap: var(--qb-gap-3xs); }
.qb-gallery img { width: 100%; aspect-ratio: var(--qb-media-aspect, auto); object-fit: cover; border-radius: var(--qb-media-radius); }
.qb-gallery[data-layout="masonry"] { display: block; columns: var(--qb-cols, 2); column-gap: var(--qb-gap-xs); }
.qb-gallery[data-layout="masonry"] > li { break-inside: avoid; margin-bottom: var(--qb-gap-xs); }
@media (min-width: 768px) { .qb-gallery[data-layout="masonry"] { columns: var(--qb-cols-md, 3); } }
@media (min-width: 1024px) { .qb-gallery[data-layout="masonry"] { columns: var(--qb-cols-lg, 3); } }
.qb-gallery-open { all: unset; display: block; cursor: zoom-in; width: 100%; }
.qb-gallery-open:focus-visible { outline: 2px solid var(--qb-focus-ring); outline-offset: 2px; }
.qb-lightbox { border: 0; padding: 0; background: transparent; max-width: 92vw; max-height: 92vh; overflow: visible; }
.qb-lightbox::backdrop { background: rgb(0 0 0 / 0.85); }
.qb-lightbox img { max-width: 92vw; max-height: 92vh; object-fit: contain; border-radius: var(--qb-radius-md); }
.qb-lightbox-close { position: absolute; top: -2.75rem; right: 0; background: none; border: 0; color: #fff; cursor: pointer; }
.qb-compare { position: relative; overflow: hidden; border-radius: var(--qb-media-radius); aspect-ratio: var(--qb-media-aspect, 16/9); --qb-pos: 50%; }
.qb-compare img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.qb-compare-before { position: absolute; inset: 0; clip-path: inset(0 calc(100% - var(--qb-pos)) 0 0); }
.qb-compare-before::after { content: ""; position: absolute; top: 0; bottom: 0; left: var(--qb-pos); width: 2px; background: #fff; box-shadow: 0 0 8px rgb(0 0 0 / 0.4); }
.qb-compare-range { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; }

.qb-steps { display: grid; gap: var(--qb-gap-lg); list-style: none; padding: 0; counter-reset: qb-step; }
@media (min-width: 1024px) { .qb-steps[data-layout="horizontal"] { grid-template-columns: repeat(var(--qb-cols-lg, 3), minmax(0, 1fr)); } }
.qb-step { display: flex; gap: var(--qb-gap-sm); align-items: flex-start; }
.qb-steps[data-layout="horizontal"] .qb-step { flex-direction: column; }
.qb-step-marker {
  display: grid; place-items: center; width: 2.75rem; height: 2.75rem; flex: none; border-radius: 9999px;
  background: var(--qb-primary); color: var(--qb-on-primary); font-size: var(--qb-step-1);
}
.qb-step > div { display: flex; flex-direction: column; gap: var(--qb-gap-3xs); }

.qb-plan {
  position: relative; display: flex; flex-direction: column; gap: var(--qb-gap-sm); padding: var(--qb-gap-lg);
  border-radius: var(--qb-radius-xl); border: var(--qb-border-width, 1px) solid var(--qb-border); height: 100%;
}
.qb-plan[data-highlighted] { border: 2px solid var(--qb-primary); box-shadow: 0 12px 40px -12px color-mix(in oklab, var(--qb-primary) 40%, transparent); }
.qb-plan > .qb-badge { position: absolute; top: 0; left: 50%; translate: -50% -50%; }
.qb-member { display: flex; flex-direction: column; gap: var(--qb-gap-3xs); }
.qb-member img { width: 100%; aspect-ratio: var(--qb-media-aspect, 3/4); object-fit: cover; border-radius: var(--qb-radius-lg); margin-bottom: var(--qb-gap-xs); }
.qb-member a { color: inherit; text-decoration: none; }

/* ---- forms ------------------------------------------------------------- */
.qb-input {
  width: 100%; font: inherit; color: var(--qb-text); background: var(--qb-background);
  border: var(--qb-border-width, 1px) solid var(--qb-border); border-radius: var(--qb-radius-md);
  padding: 0.7em 0.9em; min-height: 2.75rem;
}
.qb-input:focus-visible { outline: 2px solid var(--qb-focus-ring); outline-offset: 1px; }
textarea.qb-input { resize: vertical; }
.qb-newsletter { display: flex; flex-direction: column; gap: var(--qb-gap-sm); max-width: 40rem; }
.qb-newsletter[data-align="center"] { margin-inline: auto; align-items: center; text-align: center; }
.qb-newsletter .qb-section-header { margin-bottom: 0; }
.qb-form-inline { display: flex; gap: var(--qb-gap-2xs); width: 100%; }
.qb-form-inline[data-layout="stacked"], .qb-newsletter .qb-form-inline { flex-wrap: wrap; }
.qb-form-inline .qb-input { flex: 1 1 14rem; }
.qb-form-inline[data-layout="stacked"] > * { flex-basis: 100%; }
.qb-contact { display: grid; gap: var(--qb-gap-xl); }
@media (min-width: 1024px) { .qb-contact[data-aside] { grid-template-columns: 2fr 3fr; } }
.qb-contact .qb-section-header { margin-bottom: 0; }
.qb-contact-details { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--qb-gap-xs); }
.qb-contact-details li { display: flex; gap: 0.75em; align-items: flex-start; }
.qb-contact-details svg { color: var(--qb-primary); margin-top: 0.2em; flex: none; }
.qb-contact-details a { color: inherit; }
.qb-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--qb-gap-sm); align-content: start; }
.qb-field { display: flex; flex-direction: column; gap: 0.4em; grid-column: span 2; }
@media (min-width: 768px) { .qb-field[data-width="half"] { grid-column: span 1; } }
.qb-field label { font-size: var(--qb-step-n1); font-weight: 600; }
.qb-form > .qb-button { grid-column: span 2; justify-self: start; }
.qb-form-error { grid-column: 1 / -1; flex-basis: 100%; margin: 0; color: #b42318; }
.qb-form[data-state="sending"], .qb-form-inline[data-state="sending"] { opacity: .6; pointer-events: none; }
.qb-form-success { margin: 0; padding: var(--qb-gap-sm); border-radius: var(--qb-radius-md); background: color-mix(in oklab, var(--qb-text) 6%, transparent); }

/* ---- live chat --------------------------------------------------------- */
.qb-chat { position: fixed; z-index: 60; bottom: 1.25rem; inset-inline-end: 1.25rem; display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem; font-size: var(--qb-step-n1); }
.qb-chat[data-position="left"] { inset-inline: 1.25rem auto; align-items: flex-start; }
.qb-chat[data-preview] { position: relative; inset: auto; padding: var(--qb-gap-sm); align-items: flex-end; }
.qb-chat-launcher {
  position: relative; display: inline-flex; align-items: center; gap: 0.5em; border: 0; cursor: pointer; font: inherit; font-weight: 600;
  padding: 0.85em; border-radius: var(--qb-radius-full); background: var(--qb-primary); color: var(--qb-on-primary);
  box-shadow: 0 10px 30px -10px color-mix(in oklab, var(--qb-primary) 60%, transparent);
  transition: transform var(--qb-duration-fast) var(--qb-ease);
}
.qb-chat-launcher:hover { transform: translateY(-1px); }
.qb-chat-launcher:focus-visible { outline: 2px solid var(--qb-focus-ring); outline-offset: 3px; }
.qb-chat-launcher-label { display: none; padding-inline-end: 0.25em; }
@media (min-width: 1024px) { .qb-chat-launcher[aria-expanded="false"] { padding-inline: 1em 1.2em; } .qb-chat-launcher[aria-expanded="false"] .qb-chat-launcher-label { display: inline; } }
.qb-chat-badge {
  position: absolute; top: -0.3em; inset-inline-end: -0.3em; min-width: 1.4em; height: 1.4em; padding-inline: 0.35em; border-radius: var(--qb-radius-full);
  display: grid; place-items: center; font-size: 0.75em; background: var(--qb-accent); color: var(--qb-on-accent); border: 2px solid var(--qb-background);
}
.qb-chat-panel {
  display: flex; flex-direction: column; width: min(24rem, calc(100vw - 2.5rem)); height: min(34rem, calc(100dvh - 7rem));
  background: var(--qb-background); color: var(--qb-text); border: var(--qb-border-width, 1px) solid var(--qb-border);
  border-radius: var(--qb-radius-lg); overflow: hidden; box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.35);
}
.qb-chat-head { display: flex; align-items: center; justify-content: space-between; padding: 0.85em 1em; background: var(--qb-primary); color: var(--qb-on-primary); }
.qb-chat-close { border: 0; background: transparent; color: inherit; font-size: 1.5em; line-height: 1; cursor: pointer; padding: 0 0.2em; }
.qb-chat-list { flex: 1; overflow-y: auto; margin: 0; padding: 1em; list-style: none; display: flex; flex-direction: column; gap: 0.6em; background: color-mix(in oklab, var(--qb-text) 3%, var(--qb-background)); }
.qb-chat-msg { max-width: 85%; align-self: flex-start; }
.qb-chat-msg p { margin: 0; padding: 0.6em 0.85em; border-radius: var(--qb-radius-md); white-space: pre-wrap; overflow-wrap: anywhere; background: var(--qb-surface); color: var(--qb-on-surface); }
.qb-chat-msg[data-author="customer"] { align-self: flex-end; }
.qb-chat-msg[data-author="customer"] p { background: var(--qb-primary); color: var(--qb-on-primary); }
.qb-chat-msg[data-pending] { opacity: 0.6; }
.qb-chat-name { display: block; margin: 0 0 0.2em 0.2em; font-size: 0.85em; color: var(--qb-text-muted); }
.qb-chat-form { display: flex; flex-direction: column; gap: 0.5em; padding: 0.75em; border-top: var(--qb-border-width, 1px) solid var(--qb-border); }
.qb-chat-contact { display: grid; gap: 0.4em; }
.qb-chat-contact p { margin: 0; color: var(--qb-text-muted); }
.qb-chat-contact .qb-input, .qb-chat-compose .qb-input { min-height: 0; padding: 0.55em 0.75em; }
.qb-chat-compose { display: flex; gap: 0.5em; align-items: flex-end; }
.qb-chat-compose textarea { resize: none; }
.qb-chat .qb-form-error { margin: 0; }
.qb-chat-msg[data-author="customer"] .qb-chat-files { justify-content: flex-end; }
.qb-chat-files { display: flex; flex-wrap: wrap; gap: 0.35em; margin-top: 0.3em; }
.qb-chat-image { display: block; border-radius: var(--qb-radius-md); overflow: hidden; border: var(--qb-border-width, 1px) solid var(--qb-border); }
.qb-chat-image img { display: block; max-width: 14rem; max-height: 10rem; object-fit: cover; }
.qb-chat-file { display: inline-flex; align-items: center; gap: 0.4em; max-width: 100%; padding: 0.45em 0.7em; border-radius: var(--qb-radius-md); background: var(--qb-surface); color: var(--qb-on-surface); text-decoration: none; overflow-wrap: anywhere; }
.qb-chat-file small { color: var(--qb-text-muted); white-space: nowrap; }
.qb-chat-file[data-gone] { opacity: 0.6; flex-direction: column; align-items: flex-start; gap: 0; }
a.qb-chat-file:hover { text-decoration: underline; }
.qb-chat-picked { display: flex; flex-wrap: wrap; gap: 0.35em; margin: 0; padding: 0; list-style: none; }
.qb-chat-picked li { display: inline-flex; align-items: center; gap: 0.3em; max-width: 100%; padding: 0.2em 0.3em 0.2em 0.6em; border-radius: 999px; background: color-mix(in oklab, var(--qb-text) 8%, var(--qb-background)); }
.qb-chat-picked span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 12rem; }
.qb-chat-picked button { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 1.1em; line-height: 1; padding: 0 0.2em; }
.qb-chat-attach { display: inline-grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; border: 0; border-radius: var(--qb-radius-md); background: transparent; color: var(--qb-text-muted); cursor: pointer; }
.qb-chat-attach:hover:not(:disabled) { color: var(--qb-text); background: color-mix(in oklab, var(--qb-text) 6%, transparent); }
.qb-chat-attach:disabled { opacity: 0.4; cursor: default; }

/* ---- site & data ------------------------------------------------------- */
.qb-map { display: grid; gap: var(--qb-gap-lg); align-items: start; }
@media (min-width: 1024px) { .qb-map[data-details] { grid-template-columns: 1fr 2fr; } }
.qb-map .qb-section-header { margin-bottom: 0; }
.qb-map-frame { width: 100%; border: 0; border-radius: var(--qb-radius-lg); height: 24rem; }
.qb-map-frame[data-size="sm"] { height: 16rem; }
.qb-map-frame[data-size="lg"] { height: 36rem; }
.qb-announcement { display: flex; justify-content: center; gap: var(--qb-gap-lg); flex-wrap: wrap; text-align: center; }
.qb-announcement-item a, .qb-announcement-item > span { display: inline-flex; align-items: center; gap: 0.5em; color: inherit; text-decoration: none; }
.qb-announcement-item { display: inline-flex; align-items: center; gap: 0.5em; }
.qb-products { list-style: none; padding: 0; }
.qb-product-card a { display: flex; flex-direction: column; gap: var(--qb-gap-3xs); color: inherit; text-decoration: none; position: relative; }
.qb-product-card img, .qb-product-card .qb-media-placeholder { width: 100%; aspect-ratio: var(--qb-media-aspect, 1/1); object-fit: cover; border-radius: var(--qb-radius-md); margin-bottom: var(--qb-gap-2xs); }
.qb-product-card .qb-badge { position: absolute; top: 0.6rem; left: 0.6rem; }
.qb-product-title { font-weight: 600; }
.qb-product-card a:hover img { transform: scale(1.02); }
.qb-product-card img { transition: transform var(--qb-duration-base) var(--qb-ease); }

/* ---- site chrome (header / footer) ------------------------------------ */
.qb-section[data-block="SiteHeader"] { z-index: 20; }
.qb-section[data-block="SiteHeader"]:has(.qb-site-header[data-sticky]) { position: sticky; top: 0; background: var(--qb-background); }
.qb-site-header { position: relative; display: flex; align-items: center; gap: var(--qb-gap-lg); min-height: 3rem; }
.qb-site-brand { display: inline-flex; align-items: center; color: var(--qb-heading); text-decoration: none; font-family: var(--qb-font-heading, inherit); font-size: var(--qb-step-1); font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; }
.qb-site-brand img { display: block; height: 2.5rem; width: auto; }
.qb-site-nav { flex: 1; min-width: 0; }
.qb-site-nav-list { display: flex; flex-wrap: nowrap; white-space: nowrap; align-items: center; gap: var(--qb-gap-xs) var(--qb-gap-md); list-style: none; margin: 0; padding: 0; }
.qb-site-nav-list a, .qb-site-dropdown > summary { color: inherit; text-decoration: none; font-weight: 500; cursor: pointer; }
.qb-site-nav-list a:hover, .qb-site-dropdown > summary:hover, .qb-site-dropdown[open] > summary { color: var(--qb-primary); }
.qb-site-dropdown { position: relative; }
.qb-site-dropdown > summary, .qb-site-panel-list summary { list-style: none; display: inline-flex; align-items: center; gap: 0.25em; }
.qb-site-dropdown > summary::-webkit-details-marker, .qb-site-panel-list summary::-webkit-details-marker { display: none; }
.qb-site-dropdown > summary svg, .qb-site-panel-list summary svg { transition: rotate var(--qb-duration-fast) var(--qb-ease); }
.qb-site-dropdown[open] > summary svg, .qb-site-panel-list details[open] > summary svg { rotate: 180deg; }
.qb-site-dropdown > ul, .qb-site-mega {
  position: absolute; z-index: 30; top: calc(100% + 0.5rem); left: 0; min-width: 14rem; list-style: none; margin: 0;
  padding: var(--qb-gap-xs); display: grid; gap: 2px; background: var(--qb-surface); color: var(--qb-on-surface); white-space: normal;
  border: var(--qb-border-width) solid var(--qb-border); border-radius: var(--qb-radius-md); box-shadow: 0 12px 32px rgb(0 0 0 / 0.12);
  transition: opacity var(--qb-nav-in) var(--qb-ease), translate var(--qb-nav-in) var(--qb-ease);
}
@starting-style { .qb-site-dropdown[open] > ul, .qb-site-dropdown[open] > .qb-site-mega { opacity: 0; translate: 0 -0.35rem; } }
.qb-site-dropdown > ul a { display: block; padding: 0.4em 0.6em; border-radius: var(--qb-radius-sm, 4px); }
.qb-site-dropdown > ul a:hover, .qb-site-mega ul a:hover { background: color-mix(in oklab, var(--qb-primary) 10%, transparent); color: inherit; }

/* mega: the panel spans the header, links in columns, optional feature tile */
.qb-site-nav-item[data-mega], .qb-site-nav-item[data-mega] > .qb-site-dropdown { position: static; }
.qb-site-mega { left: 0; right: 0; padding: var(--qb-gap-md); gap: var(--qb-gap-md); grid-template-columns: minmax(0, 1fr); }
.qb-site-mega[data-feature] { grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem); }
.qb-site-mega ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--qb-gap-2xs) var(--qb-gap-sm); grid-template-columns: repeat(var(--qb-mega-cols, 3), minmax(0, 1fr)); align-content: start; }
.qb-site-mega ul a { display: grid; gap: 0.15em; padding: 0.6em 0.75em; border-radius: var(--qb-radius-sm, 4px); }
.qb-site-mega ul strong { font-weight: 600; color: var(--qb-heading); }
.qb-site-mega ul span { font-weight: 400; font-size: var(--qb-step--1, 0.875rem); color: var(--qb-text-muted); }
.qb-site-mega-all { position: relative; display: flex; align-items: end; overflow: hidden; border-radius: var(--qb-radius-sm, 4px); min-height: 3rem; padding: 0.75em; font-weight: 600; }
.qb-site-mega[data-feature] .qb-site-mega-all { min-height: 11rem; color: #fff; }
.qb-site-mega-all img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: scale var(--qb-duration-slow) var(--qb-ease); }
.qb-site-mega[data-feature] .qb-site-mega-all::before { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 60%); }
.qb-site-mega-all span { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 0.35em; }
.qb-site-mega-all:hover img { scale: 1.04; }
.qb-site-mega:not([data-feature]) .qb-site-mega-all { min-height: 0; padding: 0.4em 0.75em; color: var(--qb-primary); }

.qb-site-actions { display: flex; align-items: center; gap: var(--qb-gap-sm); margin-inline-start: auto; }
.qb-site-search { display: flex; align-items: center; gap: 0.4em; padding: 0.35em 0.75em; border: var(--qb-border-width) solid var(--qb-border); border-radius: var(--qb-radius-full); }
.qb-site-search input { border: 0; outline: 0; background: transparent; color: inherit; font: inherit; width: clamp(6rem, 10vw, 12rem); min-width: 0; }
.qb-site-icon { display: inline-flex; color: inherit; padding: 0.35em; border-radius: var(--qb-radius-full); border: 0; background: none; font: inherit; cursor: pointer; }
.qb-site-icon:hover { color: var(--qb-primary); }
.qb-site-search-icon { display: none; }
@media (max-width: 1400px) { .qb-site-search { display: none; } .qb-site-search-icon { display: inline-flex; } }
.qb-site-menu-toggle { display: none; }
.qb-site-header[data-collapse="always"] .qb-site-menu-toggle, .qb-site-header[data-overflow="menu"] .qb-site-menu-toggle { display: inline-flex; }
.qb-site-header[data-overflow] .qb-site-search { display: none; }
.qb-site-header[data-overflow] .qb-site-search-icon { display: inline-flex; }
.qb-site-header[data-overflow="menu"] .qb-site-nav { visibility: hidden; height: 0; overflow: hidden; }
@media (max-width: 900px) {
  .qb-site-nav { display: none; }
  .qb-site-menu-toggle { display: inline-flex; }
}
@media (max-width: 640px) {
  .qb-site-header { gap: var(--qb-gap-sm); }
  .qb-site-actions { gap: var(--qb-gap-2xs); }
  .qb-site-actions > .qb-site-cta { display: none; }
}

/* menu panel: a native popover in the top layer; motion from theme.motion.nav */
.qb-site-menu-panel {
  --qb-nav-dx: 1; --qb-nav-dy: 0; --qb-nav-ox: 100%; --qb-nav-oy: 0%;
  position: fixed; inset: 0 0 0 auto; margin: 0; border: 0; box-sizing: border-box;
  width: min(26rem, 88vw); max-width: none; height: 100dvh; max-height: none; overflow: auto; overscroll-behavior: contain;
  padding: var(--qb-gap-md) var(--qb-gap-lg) var(--qb-gap-lg); flex-direction: column; gap: var(--qb-gap-lg);
  background: var(--qb-surface); color: var(--qb-on-surface); box-shadow: 0 0 48px rgb(0 0 0 / 0.18);
  font-family: var(--qb-font-body, inherit);
  transition-property: transform, opacity, clip-path, display, overlay;
  transition-duration: var(--qb-nav-out, 220ms); transition-timing-function: var(--qb-ease);
  transition-behavior: allow-discrete;
}
.qb-site-menu-panel:popover-open { display: flex; transform: none; opacity: 1; transition-duration: var(--qb-nav-in, 380ms); }
.qb-site-menu-panel[data-side="left"] { --qb-nav-dx: -1; --qb-nav-ox: 0%; inset: 0 auto 0 0; }
.qb-site-menu-panel[data-side="top"] { --qb-nav-dx: 0; --qb-nav-dy: -1; --qb-nav-ox: 50%; inset: 0 0 auto 0; width: 100%; height: auto; max-height: 85dvh; }
.qb-site-menu-panel[data-side="bottom"] { --qb-nav-dx: 0; --qb-nav-dy: 1; --qb-nav-ox: 50%; --qb-nav-oy: 100%; inset: auto 0 0 0; width: 100%; height: auto; max-height: 85dvh; border-radius: var(--qb-radius-lg, 16px) var(--qb-radius-lg, 16px) 0 0; }
.qb-site-menu-panel[data-menu="drop"] { box-shadow: 0 16px 40px rgb(0 0 0 / 0.14); }
.qb-site-menu-panel[data-menu="fullscreen"] { inset: 0; width: 100%; height: 100dvh; max-height: none; border-radius: 0; box-shadow: none; padding: var(--qb-gap-md) clamp(1.25rem, 6vw, 6rem) var(--qb-gap-xl); }
.qb-site-menu-panel::backdrop { background: rgb(0 0 0 / 0); transition: background-color var(--qb-nav-out, 220ms), display var(--qb-nav-out, 220ms) allow-discrete, overlay var(--qb-nav-out, 220ms) allow-discrete; }
.qb-site-menu-panel:popover-open::backdrop { background: rgb(0 0 0 / 0.35); transition-duration: var(--qb-nav-in, 380ms); }
.qb-site-menu-panel[data-menu="fullscreen"]:popover-open::backdrop { background: rgb(0 0 0 / 0); }
@starting-style { .qb-site-menu-panel:popover-open::backdrop { background: rgb(0 0 0 / 0); } }
html:has(.qb-site-menu-panel:popover-open:is([data-menu="sheet"], [data-menu="fullscreen"])) { overflow: hidden; }

/* leave = the closed state, enter = the starting style */
.qb-site-menu-panel[data-exit="slide"]:not(:popover-open) { transform: translate(calc(var(--qb-nav-dx) * 100%), calc(var(--qb-nav-dy) * 100%)); }
.qb-site-menu-panel[data-exit="fade"]:not(:popover-open) { opacity: 0; }
.qb-site-menu-panel[data-exit="scale"]:not(:popover-open) { transform: scale(0.94); opacity: 0; }
.qb-site-menu-panel[data-exit="circle"]:not(:popover-open) { clip-path: circle(0% at var(--qb-nav-ox) var(--qb-nav-oy)); }
.qb-site-menu-panel:is([data-enter="circle"], [data-exit="circle"]):popover-open { clip-path: circle(150% at var(--qb-nav-ox) var(--qb-nav-oy)); }
@starting-style {
  .qb-site-menu-panel[data-enter="slide"]:popover-open { transform: translate(calc(var(--qb-nav-dx) * 100%), calc(var(--qb-nav-dy) * 100%)); }
  .qb-site-menu-panel[data-enter="fade"]:popover-open { opacity: 0; }
  .qb-site-menu-panel[data-enter="scale"]:popover-open { transform: scale(0.94); opacity: 0; }
  .qb-site-menu-panel[data-enter="circle"]:popover-open { clip-path: circle(0% at var(--qb-nav-ox) var(--qb-nav-oy)); }
}
@media (prefers-reduced-motion: reduce) {
  .qb-site-menu-panel[data-exit]:not(:popover-open) { transform: none; clip-path: none; opacity: 0; }
  .qb-site-menu-panel[data-enter]:popover-open { clip-path: none; }
  @starting-style { .qb-site-menu-panel[data-enter]:popover-open { transform: none; clip-path: none; opacity: 0; } }
}

.qb-site-menu-top { display: flex; align-items: center; justify-content: space-between; gap: var(--qb-gap-sm); min-height: 3rem; }
.qb-site-menu-panel > nav { flex: 1; }
.qb-site-menu-panel > .qb-site-cta { align-self: flex-start; }
.qb-site-panel-list, .qb-site-panel-list ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.15em; }
.qb-site-panel-list a, .qb-site-panel-list summary { display: flex; padding: 0.55em 0; color: inherit; text-decoration: none; font-weight: 500; font-size: var(--qb-step-1); cursor: pointer; }
.qb-site-panel-list a:hover, .qb-site-panel-list summary:hover { color: var(--qb-primary); }
.qb-site-panel-list ul { padding: 0 0 var(--qb-gap-xs) var(--qb-gap-sm); border-inline-start: var(--qb-border-width) solid var(--qb-border); margin-inline-start: 0.1em; }
.qb-site-panel-list ul a { font-size: var(--qb-step-0); padding: 0.35em 0; font-weight: 400; }
.qb-site-menu-panel[data-menu="fullscreen"] > nav { display: grid; align-content: center; }
.qb-site-menu-panel[data-menu="fullscreen"] .qb-site-panel-list > li > a,
.qb-site-menu-panel[data-menu="fullscreen"] .qb-site-panel-list > li > details > summary { font-family: var(--qb-font-display, inherit); font-weight: var(--qb-font-display-weight, 600); text-transform: var(--qb-font-display-case, none); letter-spacing: var(--qb-font-display-tracking, 0); font-size: clamp(2.25rem, 7vw, 5rem); line-height: 1.02; color: var(--qb-heading); padding: 0.1em 0; }
.qb-site-menu-panel[data-menu="fullscreen"] .qb-site-panel-list > li > a:hover,
.qb-site-menu-panel[data-menu="fullscreen"] .qb-site-panel-list > li > details > summary:hover { color: var(--qb-primary); }
.qb-site-menu-panel[data-menu="fullscreen"] .qb-site-panel-list ul a { font-size: var(--qb-step-1); }
.qb-site-menu-panel[data-menu="fullscreen"]:popover-open .qb-site-panel-list > li { animation: qb-nav-item var(--qb-nav-in, 380ms) var(--qb-ease) both; animation-delay: calc(var(--i, 0) * 45ms + 90ms); }
@keyframes qb-nav-item { from { opacity: 0; translate: 0 0.6em; } }
@media (prefers-reduced-motion: reduce) { .qb-site-menu-panel[data-menu="fullscreen"]:popover-open .qb-site-panel-list > li { animation: none; } }

/* sidebar: a fixed rail on large screens, the content shifts beside it */
@media (min-width: 901px) {
  [data-theme]:has(.qb-site-header[data-pattern="sidebar"]) { --qb-rail: 17rem; padding-inline-start: var(--qb-rail); }
  [data-theme]:has(.qb-site-header[data-pattern="sidebar"][data-side="right"]) { padding-inline: 0 var(--qb-rail); }
  .qb-section[data-block="SiteHeader"]:has(.qb-site-header[data-pattern="sidebar"]) {
    position: fixed; inset-block: 0; inset-inline-start: 0; width: var(--qb-rail); overflow-y: auto; overscroll-behavior: contain;
    background: var(--qb-background); border-inline-end: var(--qb-border-width) solid var(--qb-border);
  }
  .qb-section[data-block="SiteHeader"]:has(.qb-site-header[data-pattern="sidebar"][data-side="right"]) { inset-inline: auto 0; border-inline: var(--qb-border-width) solid var(--qb-border) 0; }
  .qb-site-header[data-pattern="sidebar"] { flex-direction: column; align-items: stretch; gap: var(--qb-gap-lg); min-height: calc(100dvh - var(--qb-section-pt, 0px) - var(--qb-section-pb, 0px)); padding-block: var(--qb-gap-sm); }
  .qb-site-header[data-pattern="sidebar"] .qb-site-nav { flex: 1; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-nav-list { flex-direction: column; align-items: stretch; white-space: normal; gap: 0.15em; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-nav-list a, .qb-site-header[data-pattern="sidebar"] .qb-site-dropdown > summary { display: flex; padding: 0.4em 0; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-dropdown > summary { justify-content: space-between; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-dropdown > ul { position: static; min-width: 0; box-shadow: none; border: 0; border-inline-start: var(--qb-border-width) solid var(--qb-border); border-radius: 0; background: none; color: inherit; padding: 0 0 0 var(--qb-gap-sm); margin-block-end: var(--qb-gap-2xs); }
  .qb-site-header[data-pattern="sidebar"] .qb-site-actions { margin-inline-start: 0; flex-wrap: wrap; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-search { display: flex; width: 100%; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-search input { width: 100%; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-search-icon { display: none; }
  .qb-site-header[data-pattern="sidebar"] .qb-site-actions > .qb-site-cta { order: -1; width: 100%; justify-content: center; }
}
.qb-site-footer-grid { display: grid; gap: var(--qb-gap-lg); grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
.qb-site-footer-brand { display: grid; gap: var(--qb-gap-xs); align-content: start; }
.qb-site-footer-brand p { margin: 0; max-width: 36ch; }
.qb-site-footer-title { font-size: var(--qb-step-0); margin: 0 0 var(--qb-gap-xs); color: var(--qb-heading); }
.qb-site-footer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35em; }
.qb-site-footer a { color: inherit; text-decoration: none; }
.qb-site-footer .qb-muted { color: var(--qb-text-muted); }
.qb-site-footer a:hover { color: var(--qb-primary); }
.qb-site-footer address { font-style: normal; display: grid; gap: 0.5em; align-content: start; }
.qb-site-footer address > * { display: inline-flex; align-items: center; gap: 0.5em; }
.qb-site-legal { margin: var(--qb-gap-lg) 0 0; padding-top: var(--qb-gap-md); border-top: var(--qb-border-width) solid var(--qb-border); }
/* ---- commerce (product detail, cart) ------------------------------------ */
.qb-site-icon { position: relative; }
.qb-cart-count {
  position: absolute; top: -0.15em; right: -0.25em; min-width: 1.15rem; height: 1.15rem; padding: 0 0.3em;
  display: inline-grid; place-items: center; border-radius: var(--qb-radius-full);
  background: var(--qb-primary); color: var(--qb-on-primary); font-size: 0.7rem; font-weight: 700; line-height: 1;
}
.qb-products-empty { margin: 0; }
.qb-pdp { display: grid; gap: var(--qb-gap-xl); align-items: start; }
@media (min-width: 900px) {
  .qb-pdp { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .qb-pdp[data-gallery="end"] > .qb-pdp-gallery { order: 2; }
  .qb-pdp-info { position: sticky; top: var(--qb-gap-lg); }
}
.qb-pdp-gallery { display: grid; gap: var(--qb-gap-xs); }
.qb-pdp-main { display: block; width: 100%; aspect-ratio: var(--qb-media-aspect, 1/1); object-fit: contain; background: var(--qb-surface); border-radius: var(--qb-radius-lg); }
.qb-pdp-thumbs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); gap: var(--qb-gap-xs); }
.qb-pdp-thumbs img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--qb-radius-md); background: var(--qb-surface); }
.qb-pdp-info { display: flex; flex-direction: column; align-items: flex-start; gap: var(--qb-gap-sm); }
.qb-pdp-info > .qb-eyebrow { margin: 0; }
.qb-pdp-title { font-size: var(--qb-step-4); }
.qb-pdp-info > .qb-price { margin: 0; }
.qb-pdp-info > .qb-button { width: 100%; }
.qb-pdp-notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5em; }
.qb-pdp-notes li { display: flex; align-items: center; gap: 0.6em; }
.qb-pdp-notes svg { color: var(--qb-primary); flex: none; }
.qb-pdp-description { padding-top: var(--qb-gap-sm); border-top: var(--qb-border-width) solid var(--qb-border); width: 100%; }
.qb-buybox { display: grid; gap: var(--qb-gap-sm); width: 100%; }
.qb-buybox .qb-field { grid-column: auto; }
.qb-buybox-row { display: flex; gap: var(--qb-gap-xs); flex-wrap: wrap; }
.qb-buybox-row > .qb-button { flex: 1 1 12rem; }
.qb-buybox-status { margin: 0; min-height: 1.5em; margin-bottom: calc(-1 * var(--qb-gap-sm)); font-size: var(--qb-step-n1); }
.qb-buybox-status a { color: var(--qb-link); }
.qb-qty {
  display: inline-flex; align-items: stretch; border: var(--qb-border-width, 1px) solid var(--qb-border);
  border-radius: var(--qb-btn-radius, var(--qb-radius-md)); overflow: hidden; background: var(--qb-background);
}
.qb-qty button { all: unset; cursor: pointer; padding: 0 0.85em; display: grid; place-items: center; font-size: 1.1em; }
.qb-qty button:disabled { opacity: 0.35; cursor: default; }
.qb-qty button:hover:not(:disabled) { color: var(--qb-primary); }
.qb-qty input { width: 2.75em; border: 0; text-align: center; font: inherit; color: inherit; background: transparent; -moz-appearance: textfield; }
.qb-qty input::-webkit-inner-spin-button, .qb-qty input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.qb-qty[data-size="sm"] { font-size: var(--qb-step-n1); }
.qb-qty[data-size="sm"] input { padding-block: 0.45em; }
.qb-cart { display: grid; gap: var(--qb-gap-lg); align-items: start; }
@media (min-width: 900px) { .qb-cart { grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr); } }
.qb-cart-lines { list-style: none; margin: 0; padding: 0; border-top: var(--qb-border-width) solid var(--qb-border); }
.qb-cart-line {
  display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; grid-template-areas: "img info total" "img qty remove";
  gap: var(--qb-gap-2xs) var(--qb-gap-sm); align-items: center; padding: var(--qb-gap-sm) 0; border-bottom: var(--qb-border-width) solid var(--qb-border);
}
.qb-cart-line > img, .qb-cart-line > .qb-media-placeholder { grid-area: img; width: 4.5rem; aspect-ratio: 1; object-fit: contain; background: var(--qb-surface); border-radius: var(--qb-radius-md); align-self: start; }
.qb-cart-line-info { grid-area: info; display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.qb-cart-line-info a { color: var(--qb-heading); font-weight: 600; text-decoration: none; }
.qb-cart-line-info a:hover { color: var(--qb-primary); }
.qb-cart-line > .qb-qty { grid-area: qty; justify-self: start; }
.qb-cart-line-total { grid-area: total; text-align: end; color: var(--qb-heading); }
.qb-cart-remove { all: unset; grid-area: remove; justify-self: end; cursor: pointer; font-size: var(--qb-step-n1); color: var(--qb-text-muted); text-decoration: underline; }
.qb-cart-remove:hover { color: var(--qb-danger, #b91c1c); }
.qb-cart-summary {
  display: flex; flex-direction: column; gap: var(--qb-gap-sm); padding: var(--qb-gap-md); background: var(--qb-surface);
  color: var(--qb-on-surface); border-radius: var(--qb-radius-lg);
}
@media (min-width: 900px) { .qb-cart-summary { position: sticky; top: var(--qb-gap-lg); } }
.qb-cart-summary > * { margin: 0; }
.qb-cart-summary > .qb-button { width: 100%; }
.qb-cart-summary > a { color: var(--qb-link); text-align: center; }
.qb-cart-subtotal { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--qb-step-1); }
.qb-cart-subtotal strong { color: var(--qb-heading); }
.qb-cart-error { color: var(--qb-danger, #b91c1c); font-size: var(--qb-step-n1); }
.qb-cart-empty { display: flex; flex-direction: column; align-items: center; gap: var(--qb-gap-sm); text-align: center; padding: var(--qb-gap-xl) 0; }

/* account */
.qb-account { display: grid; gap: var(--qb-gap-md); max-width: 44rem; min-height: 12rem; }
.qb-account[data-mode="signIn"], .qb-account[data-mode="signUp"] { max-width: 28rem; }
.qb-account-tabs { display: flex; gap: var(--qb-gap-xs); border-bottom: 1px solid var(--qb-border); }
.qb-account-tabs button { appearance: none; background: none; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: 0.6em 0.2em; font: inherit; font-weight: 600; color: var(--qb-text-muted); cursor: pointer; }
.qb-account-tabs button[aria-selected="true"] { color: var(--qb-heading); border-bottom-color: var(--qb-accent); }
.qb-account-form { display: grid; gap: var(--qb-gap-sm); }
.qb-account-form .qb-field { grid-column: auto; }
.qb-account-error { margin: 0; color: var(--qb-danger, #b91c1c); font-size: var(--qb-step-n1); }
.qb-account-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--qb-gap-sm); padding-bottom: var(--qb-gap-sm); border-bottom: 1px solid var(--qb-border); }
.qb-account-head p { margin: 0; }
.qb-account-actions { display: flex; flex-wrap: wrap; gap: var(--qb-gap-xs); }
.qb-account-orders { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--qb-gap-xs); }
.qb-account-order { padding: var(--qb-gap-sm); border: 1px solid var(--qb-border); border-radius: var(--qb-radius-md); background: var(--qb-surface); }
.qb-account-order p { margin: 0.4em 0 0; }
.qb-account-order-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4em var(--qb-gap-sm); }
.qb-account-order-total { margin-left: auto; }
.qb-account-status { font-size: var(--qb-step-n1); font-weight: 600; padding: 0.1em 0.6em; border-radius: 999px; background: var(--qb-border); }
`;

/**
 * Static CSS for the block library. Theme-independent: consumes `--pk-*`
 * variables from compileTheme. Blocks ship their own CSS (instead of relying
 * on the host's Tailwind) so they render identically in the Studio iframe,
 * any storefront and future client sites without `@source` scanning.
 * Responsive values travel as CSS variables set inline (`--pk-cols-md`…).
 */
export const blockCss = /* css */ `
.pk-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.pk-small { font-size: var(--pk-step-n1); }
.pk-intro { font-size: var(--pk-step-1); max-width: 60ch; margin: 0; text-wrap: pretty; }
.pk-empty {
  display: grid; place-items: center; padding: 1rem; text-align: center;
  font: 500 13px/1.3 ui-sans-serif, system-ui, sans-serif; color: var(--pk-text-muted);
  border: 1.5px dashed color-mix(in oklab, var(--pk-text) 25%, transparent);
  border-radius: var(--pk-radius-md);
  background: color-mix(in oklab, var(--pk-text) 4%, transparent);
}
.pk-media-placeholder { display: block; aspect-ratio: var(--pk-media-aspect, 1/1); border-radius: var(--pk-radius-md); background: color-mix(in oklab, var(--pk-text) 8%, transparent); }
[data-theme] img, [data-theme] video { max-width: 100%; display: block; }
[data-theme] :where(h1, h2, h3, h4, p, figure, blockquote, ul, ol) { margin: 0; }

/* ---- layout ------------------------------------------------------------ */
.pk-stack { display: flex; flex-direction: var(--pk-dir, column); min-width: 0; }
.pk-grid { display: grid; grid-template-columns: repeat(var(--pk-cols, 1), minmax(0, 1fr)); list-style: none; padding: 0; }
@media (min-width: 768px) {
  .pk-stack { flex-direction: var(--pk-dir-md, var(--pk-dir, column)); }
  .pk-grid { grid-template-columns: repeat(var(--pk-cols-md, var(--pk-cols, 1)), minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .pk-stack { flex-direction: var(--pk-dir-lg, var(--pk-dir-md, var(--pk-dir, column))); }
  .pk-grid { grid-template-columns: repeat(var(--pk-cols-lg, var(--pk-cols-md, var(--pk-cols, 1))), minmax(0, 1fr)); }
}
.pk-columns { display: grid; grid-template-columns: minmax(0, 1fr); }
.pk-column { display: flex; flex-direction: column; gap: var(--pk-gap-sm); min-width: 0; }
@media (max-width: 767px) { .pk-columns[data-reverse-mobile] > :first-child { order: 2; } }
@media (min-width: 768px) { .pk-columns { grid-template-columns: var(--pk-col-a) var(--pk-col-b); } }
.pk-box { padding: var(--pk-box-p); background: var(--pk-background); color: var(--pk-text); }
.pk-box[data-border] { border: var(--pk-border-width) solid var(--pk-border); }
@media (min-width: 768px) { .pk-box { padding: var(--pk-box-p-md, var(--pk-box-p)); } }
@media (min-width: 1024px) { .pk-box { padding: var(--pk-box-p-lg, var(--pk-box-p-md, var(--pk-box-p))); } }
.pk-spacer { height: var(--pk-spacer); }
@media (min-width: 768px) { .pk-spacer { height: var(--pk-spacer-md, var(--pk-spacer)); } }
@media (min-width: 1024px) { .pk-spacer { height: var(--pk-spacer-lg, var(--pk-spacer-md, var(--pk-spacer))); } }
.pk-divider { border: 0; border-top: var(--pk-border-width, 1px) solid var(--pk-border); width: 100%; }
.pk-divider[data-style="dashed"] { border-top-style: dashed; }
.pk-divider[data-style="dotted"] { border-top-style: dotted; border-top-width: 2px; }
.pk-divider[data-style="accent"] { width: 4rem; border-top: 3px solid var(--pk-accent-text); border-radius: 2px; }
.pk-divider[data-style="wave"] {
  border: 0; height: 12px; background: var(--pk-border);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='12'%3E%3Cpath d='M0 6 Q6 0 12 6 T24 6' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") repeat-x center / 24px 12px;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='12'%3E%3Cpath d='M0 6 Q6 0 12 6 T24 6' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") repeat-x center / 24px 12px;
}
.pk-rail {
  display: grid; grid-auto-flow: column; list-style: none; padding: 0 0 var(--pk-gap-xs);
  grid-auto-columns: calc((100% - (var(--pk-cols, 1) - 1) * var(--pk-gap-md)) / var(--pk-cols, 1) * 0.9);
  overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: thin;
}
.pk-rail > * { scroll-snap-align: start; }
@media (min-width: 768px) { .pk-rail { grid-auto-columns: calc((100% - (var(--pk-cols-md, 2) - 1) * var(--pk-gap-md)) / var(--pk-cols-md, 2)); } }
@media (min-width: 1024px) { .pk-rail { grid-auto-columns: calc((100% - (var(--pk-cols-lg, 3) - 1) * var(--pk-gap-md)) / var(--pk-cols-lg, 3)); } }

/* ---- elements ---------------------------------------------------------- */
.pk-eyebrow { color: var(--pk-accent-text); font-size: var(--pk-step-n1); letter-spacing: 0.08em; text-transform: uppercase; }
.pk-eyebrow > span { display: inline-flex; align-items: center; gap: 0.4em; }
.pk-eyebrow[data-look="pill"] > span {
  padding: 0.35em 0.9em; border-radius: var(--pk-radius-full);
  background: color-mix(in oklab, var(--pk-accent-text) 12%, transparent);
}
.pk-button[data-size="sm"] { font-size: var(--pk-step-n1); padding: calc(var(--pk-btn-py) * 0.7) calc(var(--pk-btn-px) * 0.75); }
.pk-button[data-size="lg"] { font-size: var(--pk-step-1); padding: calc(var(--pk-btn-py) * 1.25) calc(var(--pk-btn-px) * 1.25); }
.pk-button-group { display: flex; flex-wrap: wrap; align-items: center; }
@media (max-width: 767px) { .pk-stack-mobile { flex-direction: column; align-items: stretch; } .pk-stack-mobile .pk-button { width: 100%; } }
.pk-figure { display: flex; flex-direction: column; gap: var(--pk-gap-2xs); }
.pk-figure figcaption { font-size: var(--pk-step-n1); }
.pk-image, .pk-video { width: 100%; height: auto; }
.pk-video, .pk-embed { width: 100%; border: 0; object-fit: cover; }
.pk-icon { display: inline-grid; place-items: center; line-height: 1; flex: none; }
.pk-icon[data-size="sm"] { font-size: var(--pk-step-0); }
.pk-icon[data-size="md"] { font-size: var(--pk-step-2); }
.pk-icon[data-size="lg"] { font-size: var(--pk-step-4); }
.pk-icon[data-size="xl"] { font-size: var(--pk-step-6); }
.pk-icon[data-tone="primary"] { color: var(--pk-primary); }
.pk-icon[data-tone="accent"] { color: var(--pk-accent-text); }
.pk-icon[data-tone="muted"] { color: var(--pk-text-muted); }
.pk-icon[data-framed] { width: 2.2em; height: 2.2em; font-size: calc(var(--pk-step-2) * 0.8); border-radius: var(--pk-radius-lg); background: color-mix(in oklab, currentColor 12%, transparent); }
.pk-badge {
  display: inline-flex; align-items: center; width: fit-content; gap: 0.3em;
  padding: 0.2em 0.65em; border-radius: var(--pk-radius-full); font-size: var(--pk-step-n2); line-height: 1.4;
  background: var(--pk-accent); color: var(--pk-on-accent);
}
.pk-badge[data-tone="primary"] { background: var(--pk-primary); color: var(--pk-on-primary); }
.pk-badge[data-tone="neutral"] { background: var(--pk-surface); color: var(--pk-on-surface); }
.pk-badge[data-tone="outline"] { background: transparent; color: var(--pk-text); border: 1px solid currentColor; }
.pk-stat-value { font-size: var(--pk-step-5); line-height: 1; color: var(--pk-heading); }
.pk-stats[data-dividers] > * + * { border-inline-start: var(--pk-border-width, 1px) solid var(--pk-border); }
@media (max-width: 767px) { .pk-stats[data-dividers] > * + * { border-inline-start: 0; } }
.pk-price { display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em; }
.pk-price strong { color: var(--pk-heading); }
.pk-price[data-size="sm"] strong { font-size: var(--pk-step-0); }
.pk-price[data-size="md"] strong { font-size: var(--pk-step-2); }
.pk-price[data-size="lg"] strong { font-size: var(--pk-step-4); }
.pk-list { display: flex; flex-direction: column; list-style: none; padding: 0; }
.pk-list li { display: flex; gap: 0.6em; align-items: flex-start; }
.pk-list-icon { color: var(--pk-primary); flex: none; margin-top: 0.2em; }
.pk-list[data-marker="bullet"] { list-style: disc; padding-left: 1.25em; }
.pk-list[data-marker="number"] { list-style: decimal; padding-left: 1.5em; }
.pk-list[data-marker="bullet"] li, .pk-list[data-marker="number"] li { display: list-item; }
.pk-logo { display: inline-flex; align-items: center; color: var(--pk-heading); text-decoration: none; font-size: var(--pk-step-2); }
.pk-logo img { height: var(--pk-logo-h, 2.5rem); width: auto; }
.pk-logo[data-size="sm"] { --pk-logo-h: 1.75rem; }
.pk-logo[data-size="lg"] { --pk-logo-h: 3.5rem; }
.pk-logo[data-size="xl"] { --pk-logo-h: 5rem; }
.pk-avatar-block { display: inline-flex; align-items: center; gap: 0.75em; }
.pk-avatar {
  width: var(--pk-avatar, 3rem); height: var(--pk-avatar, 3rem); border-radius: 9999px; object-fit: cover; flex: none;
  display: inline-grid; place-items: center; background: var(--pk-surface); color: var(--pk-on-surface); font-weight: 600;
}
.pk-avatar-block[data-size="sm"] { --pk-avatar: 2.25rem; }
.pk-avatar-block[data-size="lg"] { --pk-avatar: 4.5rem; }
.pk-quote { display: flex; flex-direction: column; gap: var(--pk-gap-sm); }
.pk-quote-text { font-size: var(--pk-step-1); font-family: var(--pk-font-heading); color: var(--pk-heading); text-wrap: pretty; }
.pk-quote[data-size="lg"] .pk-quote-text { font-size: var(--pk-step-3); }
.pk-quote-author { display: flex; align-items: center; gap: 0.75em; }
.pk-quote-author .pk-avatar { --pk-avatar: 2.75rem; }
.pk-rating { display: flex; gap: 0.15em; color: var(--pk-accent-text); }
.pk-card { position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--pk-radius-lg); height: 100%; }
.pk-card[data-look="surface"] { background: var(--pk-surface); color: var(--pk-on-surface); }
.pk-card[data-look="outline"] { border: var(--pk-border-width, 1px) solid var(--pk-border); }
.pk-card[data-look="plain"] { border-radius: 0; overflow: visible; }
.pk-card[data-look="plain"] .pk-card-media { border-radius: var(--pk-radius-lg); }
.pk-card-media { width: 100%; object-fit: cover; aspect-ratio: var(--pk-media-aspect, auto); }
.pk-card-body { display: flex; flex-direction: column; gap: var(--pk-gap-2xs); flex: 1; }
.pk-card-link { position: absolute; inset: 0; z-index: 1; }
.pk-card[data-linked] { transition: transform var(--pk-duration-base) var(--pk-ease), box-shadow var(--pk-duration-base) var(--pk-ease); }
.pk-card[data-linked]:hover { transform: translateY(-2px); }
.pk-card-link:focus-visible { outline: 2px solid var(--pk-focus-ring); outline-offset: 2px; border-radius: inherit; }

/* ---- section building blocks -------------------------------------------- */
.pk-section-header { display: flex; flex-direction: column; gap: var(--pk-gap-xs); margin-bottom: var(--pk-gap-lg); max-width: 48rem; }
.pk-section-header[data-align="center"] { text-align: center; align-items: center; margin-inline: auto; }
.pk-section-header .pk-button { margin-top: var(--pk-gap-2xs); align-self: flex-start; }
.pk-section-header[data-align="center"] .pk-button { align-self: center; }

.pk-hero { position: relative; display: grid; gap: var(--pk-gap-xl); align-items: center; }
.pk-hero-content { position: relative; z-index: 1; max-width: 44rem; }
.pk-hero-figure { position: relative; }
.pk-hero-media { width: 100%; aspect-ratio: var(--pk-media-aspect, auto); object-fit: cover; border-radius: var(--pk-media-radius); }
@media (min-width: 1024px) {
  .pk-hero[data-layout="split"] { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
  .pk-hero[data-layout="split"][data-media-position="start"] .pk-hero-figure { order: -1; }
}
.pk-hero[data-layout="typographic"] { justify-items: center; }
.pk-hero[data-layout="typographic"] .pk-hero-content { max-width: 56rem; }
.pk-hero[data-layout="stacked"] .pk-hero-content { margin-inline: auto; text-align: center; align-items: center; }
.pk-hero[data-layout="overlay"] { display: flex; flex-direction: column; padding: var(--pk-gap-lg); color: #fff; }
.pk-hero[data-layout="overlay"] .pk-heading, .pk-hero[data-layout="overlay"] .pk-muted, .pk-hero[data-layout="overlay"] .pk-eyebrow { color: inherit; }
.pk-hero-backdrop { position: absolute; inset: 0; overflow: hidden; border-radius: var(--pk-media-radius); }
.pk-section[data-width="full"] .pk-hero-backdrop { border-radius: 0; }
.pk-hero-backdrop .pk-hero-media { height: 100%; aspect-ratio: auto; border-radius: 0; }
.pk-hero-backdrop::after { content: ""; position: absolute; inset: 0; background: #000; opacity: var(--pk-overlay, 0.4); }

.pk-split { display: grid; gap: var(--pk-gap-xl); grid-template-columns: minmax(0, 1fr); }
.pk-split-media img, .pk-split-media video { width: 100%; aspect-ratio: var(--pk-media-aspect, auto); object-fit: cover; border-radius: var(--pk-media-radius); }
@media (min-width: 768px) {
  .pk-split { grid-template-columns: var(--pk-col-a) var(--pk-col-b); }
  .pk-split[data-media-position="end"] { grid-template-columns: var(--pk-col-b) var(--pk-col-a); }
  .pk-split[data-media-position="end"] .pk-split-media { order: 2; }
  .pk-split[data-bleed] .pk-split-media img { border-radius: 0; }
}
.pk-rich-text { max-width: 44rem; margin-inline: auto; }
.pk-cta-content { display: flex; flex-direction: column; gap: var(--pk-gap-sm); align-items: center; text-align: center; }
.pk-cta[data-panel] { padding: var(--pk-gap-xl) var(--pk-gap-lg); border-radius: var(--pk-radius-xl); }
@media (min-width: 768px) {
  .pk-cta[data-layout="row"] .pk-cta-content { flex-direction: row; justify-content: space-between; text-align: start; flex-wrap: wrap; }
}
.pk-slideshow { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.pk-slideshow::-webkit-scrollbar { display: none; }
.pk-slide {
  position: relative; flex: 0 0 100%; min-height: var(--pk-slide-h, 80vh); scroll-snap-align: start;
  display: flex; flex-direction: column; padding: var(--pk-gap-xl) var(--pk-gap-lg); color: #fff; isolation: isolate;
  background: color-mix(in oklab, var(--pk-text) 70%, transparent);
}
.pk-slide > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; }
.pk-slide::after { content: ""; position: absolute; inset: 0; background: #000; opacity: var(--pk-overlay, 0.35); z-index: -1; }
.pk-slide .pk-heading, .pk-slide .pk-eyebrow { color: inherit; }
.pk-slide-content { max-width: 40rem; }

.pk-feature { display: flex; flex-direction: column; gap: var(--pk-gap-xs); height: 100%; }
.pk-feature[data-look="card"] { background: var(--pk-surface); color: var(--pk-on-surface); padding: var(--pk-gap-md); border-radius: var(--pk-radius-lg); }
.pk-feature[data-look="outline"] { border: var(--pk-border-width, 1px) solid var(--pk-border); padding: var(--pk-gap-md); border-radius: var(--pk-radius-lg); }
.pk-feature-media { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--pk-radius-md); }
.pk-testimonial[data-look="card"] { background: var(--pk-surface); color: var(--pk-on-surface); padding: var(--pk-gap-md); border-radius: var(--pk-radius-lg); height: 100%; }

.pk-faq { display: grid; gap: var(--pk-gap-lg); }
@media (min-width: 1024px) { .pk-faq[data-layout="side"] { grid-template-columns: 2fr 3fr; align-items: start; } }
.pk-faq[data-layout="side"] .pk-section-header { margin-bottom: 0; }
.pk-faq-items { display: flex; flex-direction: column; max-width: 48rem; width: 100%; margin-inline: auto; }
.pk-faq-item { border-bottom: var(--pk-border-width, 1px) solid var(--pk-border); }
.pk-faq-item summary {
  display: flex; justify-content: space-between; align-items: center; gap: 1em; cursor: pointer; list-style: none;
  padding-block: var(--pk-gap-sm); font-weight: 600; color: var(--pk-heading);
}
.pk-faq-item summary::-webkit-details-marker { display: none; }
.pk-faq-icon { flex: none; transition: transform var(--pk-duration-fast) var(--pk-ease); }
.pk-faq-item[open] .pk-faq-icon { transform: rotate(45deg); }
.pk-faq-item > p { padding-bottom: var(--pk-gap-sm); }

.pk-marquee { display: flex; overflow: hidden; user-select: none; gap: 0; --pk-marquee-duration: 30s; }
.pk-marquee[data-speed="slow"] { --pk-marquee-duration: 50s; }
.pk-marquee[data-speed="fast"] { --pk-marquee-duration: 16s; }
.pk-marquee-run {
  display: flex; flex: none; min-width: 100%; justify-content: space-around; align-items: center; gap: var(--pk-gap-lg);
  padding-inline-end: var(--pk-gap-lg); list-style: none; margin: 0;
  animation: pk-marquee var(--pk-marquee-duration) linear infinite;
}
.pk-marquee[data-reverse] .pk-marquee-run { animation-direction: reverse; }
.pk-marquee:hover .pk-marquee-run { animation-play-state: paused; }
.pk-marquee-item { display: inline-flex; align-items: center; gap: var(--pk-gap-lg); white-space: nowrap; }
@keyframes pk-marquee { to { transform: translateX(-100%); } }
@media (prefers-reduced-motion: reduce) { .pk-marquee-run { animation: none; } .pk-marquee { flex-wrap: wrap; } }

.pk-logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--pk-gap-lg) var(--pk-gap-xl); list-style: none; padding: 0; }
.pk-logo-item img { height: var(--pk-logo-h, 2.5rem); width: auto; object-fit: contain; }
.pk-logos[data-size="sm"] { --pk-logo-h: 1.75rem; }
.pk-logos[data-size="lg"] { --pk-logo-h: 3.5rem; }
.pk-logos[data-mono] img { filter: grayscale(1); opacity: 0.7; transition: opacity var(--pk-duration-fast), filter var(--pk-duration-fast); }
.pk-logos[data-mono] li:hover img { filter: none; opacity: 1; }
.pk-logo-item > span { font-size: var(--pk-step-1); color: var(--pk-text-muted); }

.pk-gallery { list-style: none; padding: 0; }
.pk-gallery figure { display: flex; flex-direction: column; gap: var(--pk-gap-3xs); }
.pk-gallery img { width: 100%; aspect-ratio: var(--pk-media-aspect, auto); object-fit: cover; border-radius: var(--pk-media-radius); }
.pk-gallery[data-layout="masonry"] { display: block; columns: var(--pk-cols, 2); column-gap: var(--pk-gap-xs); }
.pk-gallery[data-layout="masonry"] > li { break-inside: avoid; margin-bottom: var(--pk-gap-xs); }
@media (min-width: 768px) { .pk-gallery[data-layout="masonry"] { columns: var(--pk-cols-md, 3); } }
@media (min-width: 1024px) { .pk-gallery[data-layout="masonry"] { columns: var(--pk-cols-lg, 3); } }
.pk-gallery-open { all: unset; display: block; cursor: zoom-in; width: 100%; }
.pk-gallery-open:focus-visible { outline: 2px solid var(--pk-focus-ring); outline-offset: 2px; }
.pk-lightbox { border: 0; padding: 0; background: transparent; max-width: 92vw; max-height: 92vh; overflow: visible; }
.pk-lightbox::backdrop { background: rgb(0 0 0 / 0.85); }
.pk-lightbox img { max-width: 92vw; max-height: 92vh; object-fit: contain; border-radius: var(--pk-radius-md); }
.pk-lightbox-close { position: absolute; top: -2.75rem; right: 0; background: none; border: 0; color: #fff; cursor: pointer; }
.pk-compare { position: relative; overflow: hidden; border-radius: var(--pk-media-radius); aspect-ratio: var(--pk-media-aspect, 16/9); --pk-pos: 50%; }
.pk-compare img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pk-compare-before { position: absolute; inset: 0; clip-path: inset(0 calc(100% - var(--pk-pos)) 0 0); }
.pk-compare-before::after { content: ""; position: absolute; top: 0; bottom: 0; left: var(--pk-pos); width: 2px; background: #fff; box-shadow: 0 0 8px rgb(0 0 0 / 0.4); }
.pk-compare-range { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; }

.pk-steps { display: grid; gap: var(--pk-gap-lg); list-style: none; padding: 0; counter-reset: pk-step; }
@media (min-width: 1024px) { .pk-steps[data-layout="horizontal"] { grid-template-columns: repeat(var(--pk-cols-lg, 3), minmax(0, 1fr)); } }
.pk-step { display: flex; gap: var(--pk-gap-sm); align-items: flex-start; }
.pk-steps[data-layout="horizontal"] .pk-step { flex-direction: column; }
.pk-step-marker {
  display: grid; place-items: center; width: 2.75rem; height: 2.75rem; flex: none; border-radius: 9999px;
  background: var(--pk-primary); color: var(--pk-on-primary); font-size: var(--pk-step-1);
}
.pk-step > div { display: flex; flex-direction: column; gap: var(--pk-gap-3xs); }

.pk-plan {
  position: relative; display: flex; flex-direction: column; gap: var(--pk-gap-sm); padding: var(--pk-gap-lg);
  border-radius: var(--pk-radius-xl); border: var(--pk-border-width, 1px) solid var(--pk-border); height: 100%;
}
.pk-plan[data-highlighted] { border: 2px solid var(--pk-primary); box-shadow: 0 12px 40px -12px color-mix(in oklab, var(--pk-primary) 40%, transparent); }
.pk-plan > .pk-badge { position: absolute; top: 0; left: 50%; translate: -50% -50%; }
.pk-member { display: flex; flex-direction: column; gap: var(--pk-gap-3xs); }
.pk-member img { width: 100%; aspect-ratio: var(--pk-media-aspect, 3/4); object-fit: cover; border-radius: var(--pk-radius-lg); margin-bottom: var(--pk-gap-xs); }
.pk-member a { color: inherit; text-decoration: none; }

/* ---- forms ------------------------------------------------------------- */
.pk-input {
  width: 100%; font: inherit; color: var(--pk-text); background: var(--pk-background);
  border: var(--pk-border-width, 1px) solid var(--pk-border); border-radius: var(--pk-radius-md);
  padding: 0.7em 0.9em; min-height: 2.75rem;
}
.pk-input:focus-visible { outline: 2px solid var(--pk-focus-ring); outline-offset: 1px; }
textarea.pk-input { resize: vertical; }
.pk-newsletter { display: flex; flex-direction: column; gap: var(--pk-gap-sm); max-width: 40rem; }
.pk-newsletter[data-align="center"] { margin-inline: auto; align-items: center; text-align: center; }
.pk-newsletter .pk-section-header { margin-bottom: 0; }
.pk-form-inline { display: flex; gap: var(--pk-gap-2xs); width: 100%; }
.pk-form-inline[data-layout="stacked"], .pk-newsletter .pk-form-inline { flex-wrap: wrap; }
.pk-form-inline .pk-input { flex: 1 1 14rem; }
.pk-form-inline[data-layout="stacked"] > * { flex-basis: 100%; }
.pk-contact { display: grid; gap: var(--pk-gap-xl); }
@media (min-width: 1024px) { .pk-contact[data-aside] { grid-template-columns: 2fr 3fr; } }
.pk-contact .pk-section-header { margin-bottom: 0; }
.pk-contact-details { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--pk-gap-xs); }
.pk-contact-details li { display: flex; gap: 0.75em; align-items: flex-start; }
.pk-contact-details svg { color: var(--pk-primary); margin-top: 0.2em; flex: none; }
.pk-contact-details a { color: inherit; }
.pk-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--pk-gap-sm); align-content: start; }
.pk-field { display: flex; flex-direction: column; gap: 0.4em; grid-column: span 2; }
@media (min-width: 768px) { .pk-field[data-width="half"] { grid-column: span 1; } }
.pk-field label { font-size: var(--pk-step-n1); font-weight: 600; }
.pk-form > .pk-button { grid-column: span 2; justify-self: start; }

/* ---- site & data ------------------------------------------------------- */
.pk-map { display: grid; gap: var(--pk-gap-lg); align-items: start; }
@media (min-width: 1024px) { .pk-map[data-details] { grid-template-columns: 1fr 2fr; } }
.pk-map .pk-section-header { margin-bottom: 0; }
.pk-map-frame { width: 100%; border: 0; border-radius: var(--pk-radius-lg); height: 24rem; }
.pk-map-frame[data-size="sm"] { height: 16rem; }
.pk-map-frame[data-size="lg"] { height: 36rem; }
.pk-announcement { display: flex; justify-content: center; gap: var(--pk-gap-lg); flex-wrap: wrap; text-align: center; }
.pk-announcement-item a, .pk-announcement-item > span { display: inline-flex; align-items: center; gap: 0.5em; color: inherit; text-decoration: none; }
.pk-announcement-item { display: inline-flex; align-items: center; gap: 0.5em; }
.pk-products { list-style: none; padding: 0; }
.pk-product-card a { display: flex; flex-direction: column; gap: var(--pk-gap-3xs); color: inherit; text-decoration: none; position: relative; }
.pk-product-card img, .pk-product-card .pk-media-placeholder { width: 100%; aspect-ratio: var(--pk-media-aspect, 1/1); object-fit: cover; border-radius: var(--pk-radius-md); margin-bottom: var(--pk-gap-2xs); }
.pk-product-card .pk-badge { position: absolute; top: 0.6rem; left: 0.6rem; }
.pk-product-title { font-weight: 600; }
.pk-product-card a:hover img { transform: scale(1.02); }
.pk-product-card img { transition: transform var(--pk-duration-base) var(--pk-ease); }

/* ---- site chrome (header / footer) ------------------------------------ */
.pk-section[data-block="SiteHeader"] { z-index: 20; }
.pk-site-header { position: relative; display: flex; align-items: center; gap: var(--pk-gap-lg); min-height: 3rem; }
.pk-site-brand { display: inline-flex; align-items: center; color: var(--pk-heading); text-decoration: none; font-family: var(--pk-font-heading, inherit); font-size: var(--pk-step-1); font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; }
.pk-site-brand img { display: block; height: 2.5rem; width: auto; }
.pk-site-nav { flex: 1; min-width: 0; }
.pk-site-nav-list { display: flex; flex-wrap: nowrap; white-space: nowrap; align-items: center; gap: var(--pk-gap-xs) var(--pk-gap-md); list-style: none; margin: 0; padding: 0; }
.pk-site-nav-list a, .pk-site-dropdown > summary { color: inherit; text-decoration: none; font-weight: 500; cursor: pointer; }
.pk-site-nav-list a:hover, .pk-site-dropdown > summary:hover { color: var(--pk-primary); }
.pk-site-dropdown { position: relative; }
.pk-site-dropdown > summary { list-style: none; display: inline-flex; align-items: center; gap: 0.25em; }
.pk-site-dropdown > summary::-webkit-details-marker, .pk-site-menu > summary::-webkit-details-marker { display: none; }
.pk-site-dropdown > ul {
  position: absolute; z-index: 30; top: calc(100% + 0.5rem); left: 0; min-width: 14rem; list-style: none; margin: 0;
  padding: var(--pk-gap-xs); display: grid; gap: 2px; background: var(--pk-surface); color: var(--pk-on-surface);
  border: var(--pk-border-width) solid var(--pk-border); border-radius: var(--pk-radius-md); box-shadow: 0 12px 32px rgb(0 0 0 / 0.12);
}
.pk-site-dropdown > ul a { display: block; padding: 0.4em 0.6em; border-radius: var(--pk-radius-sm, 4px); }
.pk-site-dropdown > ul a:hover { background: color-mix(in oklab, var(--pk-primary) 10%, transparent); }
.pk-site-actions { display: flex; align-items: center; gap: var(--pk-gap-sm); margin-inline-start: auto; }
.pk-site-search { display: flex; align-items: center; gap: 0.4em; padding: 0.35em 0.75em; border: var(--pk-border-width) solid var(--pk-border); border-radius: var(--pk-radius-full); }
.pk-site-search input { border: 0; outline: 0; background: transparent; color: inherit; font: inherit; width: clamp(6rem, 10vw, 12rem); min-width: 0; }
.pk-site-icon { display: inline-flex; color: inherit; padding: 0.35em; border-radius: var(--pk-radius-full); }
.pk-site-icon:hover { color: var(--pk-primary); }
.pk-site-menu { display: none; }
.pk-site-menu > summary { list-style: none; cursor: pointer; display: inline-flex; padding: 0.25em; }
.pk-site-menu > nav {
  position: absolute; z-index: 40; left: 0; right: 0; margin-top: 0.75rem; padding: var(--pk-gap-md);
  background: var(--pk-surface); color: var(--pk-on-surface); border-block: var(--pk-border-width) solid var(--pk-border);
}
.pk-site-menu .pk-site-nav-list { flex-direction: column; align-items: stretch; white-space: normal; }
.pk-site-menu nav > .pk-site-cta { display: none; margin-top: var(--pk-gap-md); }
.pk-site-search-icon { display: none; }
@media (max-width: 1400px) { .pk-site-search { display: none; } .pk-site-search-icon { display: inline-flex; } }
.pk-site-menu .pk-site-dropdown > ul { position: static; box-shadow: none; border: 0; padding-inline-start: var(--pk-gap-sm); }
@media (max-width: 900px) {
  .pk-site-nav { display: none; }
  .pk-site-menu { display: block; }
}
@media (max-width: 640px) {
  .pk-site-header { gap: var(--pk-gap-sm); }
  .pk-site-actions { gap: var(--pk-gap-2xs); }
  .pk-site-actions > .pk-site-cta { display: none; }
  .pk-site-menu nav > .pk-site-cta { display: inline-flex; }
}
.pk-site-footer-grid { display: grid; gap: var(--pk-gap-lg); grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
.pk-site-footer-brand { display: grid; gap: var(--pk-gap-xs); align-content: start; }
.pk-site-footer-brand p { margin: 0; max-width: 36ch; }
.pk-site-footer-title { font-size: var(--pk-step-0); margin: 0 0 var(--pk-gap-xs); color: var(--pk-heading); }
.pk-site-footer ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35em; }
.pk-site-footer a { color: inherit; text-decoration: none; }
.pk-site-footer .pk-muted { color: var(--pk-text-muted); }
.pk-site-footer a:hover { color: var(--pk-primary); }
.pk-site-footer address { font-style: normal; display: grid; gap: 0.5em; align-content: start; }
.pk-site-footer address > * { display: inline-flex; align-items: center; gap: 0.5em; }
.pk-site-legal { margin: var(--pk-gap-lg) 0 0; padding-top: var(--pk-gap-md); border-top: var(--pk-border-width) solid var(--pk-border); }
/* ---- commerce (product detail, cart) ------------------------------------ */
.pk-site-icon { position: relative; }
.pk-cart-count {
  position: absolute; top: -0.15em; right: -0.25em; min-width: 1.15rem; height: 1.15rem; padding: 0 0.3em;
  display: inline-grid; place-items: center; border-radius: var(--pk-radius-full);
  background: var(--pk-primary); color: var(--pk-on-primary); font-size: 0.7rem; font-weight: 700; line-height: 1;
}
.pk-products-empty { margin: 0; }
.pk-pdp { display: grid; gap: var(--pk-gap-xl); align-items: start; }
@media (min-width: 900px) {
  .pk-pdp { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .pk-pdp[data-gallery="end"] > .pk-pdp-gallery { order: 2; }
  .pk-pdp-info { position: sticky; top: var(--pk-gap-lg); }
}
.pk-pdp-gallery { display: grid; gap: var(--pk-gap-xs); }
.pk-pdp-main { display: block; width: 100%; aspect-ratio: var(--pk-media-aspect, 1/1); object-fit: contain; background: var(--pk-surface); border-radius: var(--pk-radius-lg); }
.pk-pdp-thumbs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); gap: var(--pk-gap-xs); }
.pk-pdp-thumbs img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--pk-radius-md); background: var(--pk-surface); }
.pk-pdp-info { display: flex; flex-direction: column; align-items: flex-start; gap: var(--pk-gap-sm); }
.pk-pdp-info > .pk-eyebrow { margin: 0; }
.pk-pdp-title { font-size: var(--pk-step-4); }
.pk-pdp-info > .pk-price { margin: 0; }
.pk-pdp-info > .pk-button { width: 100%; }
.pk-pdp-notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5em; }
.pk-pdp-notes li { display: flex; align-items: center; gap: 0.6em; }
.pk-pdp-notes svg { color: var(--pk-primary); flex: none; }
.pk-pdp-description { padding-top: var(--pk-gap-sm); border-top: var(--pk-border-width) solid var(--pk-border); width: 100%; }
.pk-buybox { display: grid; gap: var(--pk-gap-sm); width: 100%; }
.pk-buybox .pk-field { grid-column: auto; }
.pk-buybox-row { display: flex; gap: var(--pk-gap-xs); flex-wrap: wrap; }
.pk-buybox-row > .pk-button { flex: 1 1 12rem; }
.pk-buybox-status { margin: 0; min-height: 1.5em; margin-bottom: calc(-1 * var(--pk-gap-sm)); font-size: var(--pk-step-n1); }
.pk-buybox-status a { color: var(--pk-link); }
.pk-qty {
  display: inline-flex; align-items: stretch; border: var(--pk-border-width, 1px) solid var(--pk-border);
  border-radius: var(--pk-btn-radius, var(--pk-radius-md)); overflow: hidden; background: var(--pk-background);
}
.pk-qty button { all: unset; cursor: pointer; padding: 0 0.85em; display: grid; place-items: center; font-size: 1.1em; }
.pk-qty button:disabled { opacity: 0.35; cursor: default; }
.pk-qty button:hover:not(:disabled) { color: var(--pk-primary); }
.pk-qty input { width: 2.75em; border: 0; text-align: center; font: inherit; color: inherit; background: transparent; -moz-appearance: textfield; }
.pk-qty input::-webkit-inner-spin-button, .pk-qty input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pk-qty[data-size="sm"] { font-size: var(--pk-step-n1); }
.pk-qty[data-size="sm"] input { padding-block: 0.45em; }
.pk-cart { display: grid; gap: var(--pk-gap-lg); align-items: start; }
@media (min-width: 900px) { .pk-cart { grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr); } }
.pk-cart-lines { list-style: none; margin: 0; padding: 0; border-top: var(--pk-border-width) solid var(--pk-border); }
.pk-cart-line {
  display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; grid-template-areas: "img info total" "img qty remove";
  gap: var(--pk-gap-2xs) var(--pk-gap-sm); align-items: center; padding: var(--pk-gap-sm) 0; border-bottom: var(--pk-border-width) solid var(--pk-border);
}
.pk-cart-line > img, .pk-cart-line > .pk-media-placeholder { grid-area: img; width: 4.5rem; aspect-ratio: 1; object-fit: contain; background: var(--pk-surface); border-radius: var(--pk-radius-md); align-self: start; }
.pk-cart-line-info { grid-area: info; display: flex; flex-direction: column; gap: 0.15em; min-width: 0; }
.pk-cart-line-info a { color: var(--pk-heading); font-weight: 600; text-decoration: none; }
.pk-cart-line-info a:hover { color: var(--pk-primary); }
.pk-cart-line > .pk-qty { grid-area: qty; justify-self: start; }
.pk-cart-line-total { grid-area: total; text-align: end; color: var(--pk-heading); }
.pk-cart-remove { all: unset; grid-area: remove; justify-self: end; cursor: pointer; font-size: var(--pk-step-n1); color: var(--pk-text-muted); text-decoration: underline; }
.pk-cart-remove:hover { color: var(--pk-danger, #b91c1c); }
.pk-cart-summary {
  display: flex; flex-direction: column; gap: var(--pk-gap-sm); padding: var(--pk-gap-md); background: var(--pk-surface);
  color: var(--pk-on-surface); border-radius: var(--pk-radius-lg);
}
@media (min-width: 900px) { .pk-cart-summary { position: sticky; top: var(--pk-gap-lg); } }
.pk-cart-summary > * { margin: 0; }
.pk-cart-summary > .pk-button { width: 100%; }
.pk-cart-summary > a { color: var(--pk-link); text-align: center; }
.pk-cart-subtotal { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--pk-step-1); }
.pk-cart-subtotal strong { color: var(--pk-heading); }
.pk-cart-error { color: var(--pk-danger, #b91c1c); font-size: var(--pk-step-n1); }
.pk-cart-empty { display: flex; flex-direction: column; align-items: center; gap: var(--pk-gap-sm); text-align: center; padding: var(--pk-gap-xl) 0; }
`;

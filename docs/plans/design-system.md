# Plan: Design-system expansion ("the shell") before the HM Froid build

Status: PLAN MODE, nothing in the repo has been changed. Companion to `plan.md` (core plan);
p5-p8 there stay queued. Target: Fable can design HM Froid, then TailG, through the editor and
the block DSL alone, with no one-off CSS.

## 1. Problem statement

Today a section is a bag of fields plus Section Chrome (scheme, width, spacing, background,
edges, art, entrance, hideOn). The theme (`@qubo/stylekit`) owns palette, schemes, type, space,
shape, buttons and a three-field `motion` block. Enough for a cookie-cutter page, not for what a
Fable-grade design actually uses:

- text decoration (a word with a squiggle, paint stroke, box, gradient fill), per locale
- surface treatment beyond "image + overlay" (gradients, grain, patterns, glows)
- a motion system: durations, easings, reveal choreography, hover, page transitions
- ambient and seasonal effects, page- or section-scoped
- navigation variants (dropdown, mega, sidebar sheet, fullscreen with circular reveal)
- a Brand tab (logo set, favicon, OG image, icon set, voice) that presets derive from
- media as real blocks (Image already is; it needs masks, aspect, hover, video/gif parity)

The Shopify critique boils down to: concepts are not native, so every section re-declares them
and AI output has no shared vocabulary. The fix is a small set of **named concepts** that live in
one place (theme or chrome), are addressable by field kinds, rendered by one runtime, and exposed
to AI through the existing JSON-schema export. Features slot into a concept instead of inventing
a bubble.

## 2. The shell: concept tree

Each node is a **concept** with (a) where it is stored, (b) how a field references it, (c) who
renders it. A new feature must name its parent node; if none fits, the tree grows, not the block.

```
Theme (stylekit)                              Document (blocks)
├─ Brand            NEW                       ├─ Section Chrome        EXTEND
│  logos, favicon, og, icon set, voice        │  surface, edges, art, reveal, effect, hideOn
├─ Palette / Schemes  (exists)                ├─ Element modifiers     NEW
├─ Type               (exists)                │  text.decor, media.mask, media.hover
├─ Space / Shape      (exists)                ├─ Nav pattern           NEW (SiteHeader)
├─ Surfaces         NEW                       └─ Page meta             EXTEND
│  gradient, pattern, grain, glow presets        transition override, effect override
├─ Decor            NEW
│  text decoration presets (squiggle, stroke, box, underline, gradient)
├─ Motion           EXTEND
│  tokens (durations, easings), reveal choreography, hover, transition presets, nav motion
├─ Effects          NEW
│  ambient/seasonal presets (snow, particles, grain, aurora), scope, schedule
└─ Nav              NEW
   pattern default, sheet/fullscreen motion
```

### 2.1 Brand (theme)
`theme.brand = { name, logos: { primary, inverse, mark, wordmark }, favicon, ogImage, iconSet:
"lucide" | "phosphor" | "custom", voice: { tone, avoid[] } }`. Media refs reuse the `media`
field shape. Presets elsewhere (transitions, effects) reference `brand.logos.mark` and palette
tokens instead of hardcoding. Editor: "Brand" becomes the first tab of the theme panel.
Storefront: favicon/OG/manifest read from it (ties into the SEO layer already built).

### 2.2 Decor (theme) + `text.decor` modifier (document)
Theme holds named decoration presets: `{ id, kind: "squiggle" | "stroke" | "box" | "underline"
| "gradient" | "circle" | "highlighter", color: RoleRef, thickness, offset, animate }`. Each kind
is an inline SVG or CSS paint under `<span class="qb-decor" data-kind>`.
Document side: field kind `f.decor(of)` stores **character ranges keyed by the hash of the
exact text they were picked on** (built in ds1), so each locale keeps its own:

```
decor: { preset: "squiggle", match: "froid", ranges: [{ hash: "1x9k2a", at: [[6,13]] }, { hash: "0p3d7q", at: [[0,8],[22,27]] }] }
```

`match` is a phrase fallback for AI-written or migrated content when no range hash matches.

Offsets, not words, so "the" twice is fine and multiple highlights per heading work. The
translation `sourceHash` already marks when a source changes, so stale ranges are flagged in
the editor rather than silently misapplied (render guard: a range past the string end is
dropped). Editor: "Configure decoration" on Heading/Eyebrow/Text opens a modal listing the field
in every enabled locale; click or drag words to toggle ranges; preset picker on top. Replaces
the current `highlight` string on Heading (versioned `migrate` converts the matched word to a
range in the source locale).

### 2.3 Surfaces (theme) + Section Chrome `surface`
Chrome `background` becomes `surface = { fill: "scheme" | "token" | "gradient" | "media",
gradient?: presetId | inline, media?, overlay, grain?: 0..1, pattern?: presetId, glow?: [...] }`.
Theme holds gradient and pattern presets built from palette roles so they recolor per scheme.
`edges` and `art` stay; `art` gains `parallax` (0..1) and `blend`.

### 2.4 Motion (theme, extend) + Chrome `reveal` + element `hover`
- Tokens: `motion.durations = { fast, base, slow, page }`, `motion.easings = { standard,
  emphasized, exit, spring }` (cubic-bezier strings); `profile` and reduced-motion stay.
- Reveal (replaces `entrance`): `{ preset: fade|rise|scale|blur|mask|wipe, stagger, duration?,
  delay?, once }`. Children of Grid/Columns/Stack stagger automatically.
- Hover: element modifier for Card/Image/Button: lift, zoom, tilt, underline-slide.
- Transitions: `motion.transitions = { active: presetId | "none", presets: [{ id, kind:
  "translucent" | "icon" | "fullscreen" | "wipe", background: solid|gradient|role, icon: {
  source: brand.mark|asset, scale, rotation, anim: pulse|rotate|line|dots }, durationIn,
  durationOut, minVisible, easing }] }`. Three built-ins; users save/delete their own; defaults
  derive colours and icon from Brand.
- Nav motion: `motion.nav = { enter: slide|fade|zoom-circle, exit: slide|fade, duration }`.
- Editor controls: `DurationField` (slider, 100 ms steps, raw input), `EasingField` (preset
  select plus bezier text). A "Test" button plays the transition on the canvas.

### 2.5 Effects (theme) + Chrome `effect` + page override
`theme.effects = { presets: [{ id, kind: "snow" | "particles" | "grain" | "aurora" | "orbs" |
"confetti", density, speed, colour roles, scope: "page" | "section" }], active?: presetId,
schedule?: { from: "12-01", to: "01-06" } }`. Section Chrome gets `effect: presetId | "inherit"
| "none"`. One `<canvas class="qb-effect">` per scope, paused off-screen and under
`prefers-reduced-motion`. Theme default plus section override: both scopes, section wins.

### 2.6 Nav pattern (SiteHeader)
`pattern: "bar" | "bar-mega" | "sidebar" | "sheet" | "fullscreen"`, plus `menu: drop|sheet|fullscreen`
(small screens), `megaColumns`, `side: left|right|top|bottom` and `sticky`. Built (ds4): menu panels
are native popovers, motion comes from `theme.motion.nav` in CSS, the site runtime adds polish only.

### 2.7 Media modifiers (Image/Video)
`mask: none|circle|blob|arch|rounded|custom-svg`, `aspect`, `hover`, `caption`, `parallax`.
Video gains a gif-style autoplay/loop/muted preset and poster from focal.
Built (ds5): `mask: none|circle|arch|squircle|blob|slant|custom`, `hover: zoom|lift|color|shine`,
`reveal: fade|rise|wipe|grow`, `parallax: subtle|strong`, `captionPosition: below|overlay`, all CSS on
`.qb-media-frame`. Video shares mask, reveal and parallax; ambient loops pause off-screen. Card `hover`.

### 2.8 Page meta (document)
`page.transition?: presetId | "none"`, `page.effect?: presetId | "none"` override theme.

## 3. Runtime decisions

- **Storefront motion runtime**: CSS first (scroll-driven `animation-timeline: view()` already
  exists). View Transitions API for page transitions, with a `motion`-powered overlay only when
  the preset needs an icon or min-visible timing. Use `motion` (`motion/react` mini API, a few
  kB) rather than full framer-motion or react-spring; it is already in the admin tree and the
  storefront currently has zero motion deps. Everything gated by `prefers-reduced-motion` and
  `theme.motion.profile`.
- **Transition controller** (lesson from Kyf Moves swap-handler): one `<PageTransition>` island
  at the layout root. States: idle → covering (durationIn) → held (until navigation settles AND
  minVisible elapsed) → revealing (durationOut) → idle. Driven by Next `useLinkStatus` /
  `usePathname` plus the View Transition promise; no link wrappers; remounts are a non-issue
  because the island lives above the route segment. Hold time = max(minVisible, durationIn)
  measured from cover start, so the maths cannot go negative.
- **Icons**: Lucide stays the working set, but icon set becomes a Brand choice so Phosphor (or
  an uploaded sprite) can replace it without touching blocks.
- **Storage**: everything new lives in theme JSON and document JSON. No DB migration. One
  document migration (Heading `highlight` → `decor.ranges`) via the existing versioned `migrate`.
- **AI surface**: concepts are preset ids, so the JSON schema exposed to AI lists enums; the
  model picks from the theme instead of inventing CSS.

## 4. Taste guardrails (encoded, not just documented)
A design-review checklist in a new `qubo-design-language` skill plus Doctor rules in the theme
panel: pure white backgrounds, gradients everywhere, three-card rows with icons, Inter / Geist /
Space Grotesk as display font, uniform soft radius, shadows on every card, emoji in copy, "not X
it's Y" copy, missing TOS/privacy links, missing skeletons. The elayadesign skill is adapted (its
Geist and Tailwind-scale rules conflict with our Utopia scale and font policy), not copied
verbatim. Humanizer is installed as-is and runs on every piece of site copy.

## 5. Skills to install (P0)

| Source | Skill | Why |
| --- | --- | --- |
| mattpocock/skills | grill-me, grilling | the "grill me" session Ali asked for |
| mattpocock/skills | tdd, diagnosing-bugs | testing discipline we lack |
| mattpocock/skills | code-review, pr | gates before `--no-ff` merges |
| mattpocock/skills | codebase-design, improve-codebase-architecture | periodic deepening survey |
| mattpocock/skills | to-tickets, handoff, writing-for-agents | planning and HANDOFF hygiene |
| mattpocock/skills | prototype | throwaway HTML to test transitions/effects before wiring |
| blader/humanizer | humanizer | copy for HM Froid / TailG |
| elayadesign | landing-page-design (adapted) | page structure and copy; visual rules overridden |
| ours | qubo-design-language | the concept tree, taste guardrails, how to add a concept |

Skipped: triage, to-spec, implement, implement-spec, wayfinder, setup-matt-pocock-skills (issue
tracker driven; we use HANDOFF plus SQL todos), teach, wizard, ask-matt, research, retro.
Not a conscious earlier decision: the Pocock skills were simply never installed.

Install path `.agents/skills/<name>/SKILL.md`. `npx skills add` writes to other agents' folders;
copy the resulting `SKILL.md` files in and delete generated folders.

## 6. Phases and todos

| id | phase | scope | gate |
| --- | --- | --- | --- |
| ds0-skills | P0 | install skills from section 5, write `qubo-design-language` skeleton | files exist, no em-dashes |
| ds1-schema (done) | P1 | stylekit: brand, surfaces, decor, motion v2, effects, nav schemas with defaults and migration of the 4 themes; blocks: `f.decor(of)`, `f.duration`, `f.easing`, `f.preset(kind)`; chrome: surface, reveal, effect; Heading highlight migration | tsc, bun test (round-trips, hm-froid theme migration), JSON schema lists presets |
| ds2-editor (done) | P2 | theme panel: Brand, Surfaces, Decor, Motion (tokens, transitions, tester), Effects tabs; block panel: DurationField, EasingField, PresetField, per-locale range modal | Playwright: set fr/nl ranges on HM hero, save a transition preset, Test plays |
| ds3-runtime (done) | P3 | storefront: decor, surface, reveal choreography, `motion` dep, PageTransition island (View Transitions), effects canvas | real request on HM preview host, Lighthouse perf within 5 pts, reduced-motion check |
| ds4-nav (done) | P4 | SiteHeader patterns bar-mega / sidebar / sheet / fullscreen with nav motion, no-JS fallback kept (native popover) | Playwright at 3 viewports |
| ds5-media (done) | P5 | Image/Video masks, aspect, hover, parallax; Card hover | visual check |
| ds6-hmfroid | P6 | HM Froid theme and pages built with the new concepts, humanizer pass, design-review checklist | Ali review, publish |
| ds7-tailg | P7 | TailG same | Ali review, DNS switch |

Dependencies: ds1 → ds2, ds3; ds3 → ds4, ds5; ds2 + ds3 + ds4 + ds5 → ds6; ds6 → ds7. ds0
independent. Each phase: branch `ali/feat-ds<N>-<slug>` from staging, changeset, HANDOFF entry,
`--no-ff` merge. Core-plan todos stay pending.

Effort: ds0 small; ds1 and ds3 largest; ds2 medium-large; ds4/ds5 medium; ds6/ds7 are design
time more than engineering time.

## 7. Clarifying questions (answer, or the default applies)

1. Decoration ranges: offsets in the document (default) vs. inline markers in the text
   (`==word==`). Offsets chosen because markers leak into translation APIs and SEO text.
2. Motion library: `motion` mini API (default) vs. react-spring.
3. Effects scope: theme default plus section override (default).
4. Icons: keep Lucide default and add Phosphor as a Brand option now (default), or defer.
5. elayadesign skill: adapt (drop Geist / Tailwind-scale rules) rather than verbatim (default).
6. Heading `highlight`: migrate and remove (default) or keep a deprecated alias one release.
7. ds6-hmfroid: content only until stripe-keys is unblocked (default), or include test checkout.

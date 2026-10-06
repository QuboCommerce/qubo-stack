---
name: qubo-design-language
description: The concept tree every Qubo site design is built from (Brand, Surfaces, Decor, Motion, Effects, Nav, Media) and the taste review a page must pass. Use when designing a customer site, adding a block or field, or adding any visual feature to the editor or storefront.
---

# Qubo design language

A site is designed by choosing and tuning **concepts**, never by writing one-off CSS. A concept
lives in exactly one place, is referenced by id from documents, rendered by one runtime and
listed in the JSON schema the AI sees. Plan: `docs/plans/design-system.md`.

## Concept tree

| Concept | Stored in | Referenced from | Rendered by |
| --- | --- | --- | --- |
| Brand (logos, favicon, OG image, icon set, voice) | `theme.brand` | presets, SEO, header | storefront layout, SiteHeader |
| Palette, schemes | `theme.palette`, `theme.schemes` | `f.scheme`, `f.token`, RoleRef | `compileTheme` vars |
| Type | `theme.typeset` | `f.fontRole`, `f.step("type")` | `compileTheme` |
| Space, shape | `theme.space`, `theme.shape` | `f.step("space")` | `compileTheme` |
| Surfaces (gradients, patterns, grain) | `theme.surfaces` | Chrome `background` | `SectionChrome` |
| Decor (word highlights) | `theme.decor` | `f.decor()` on text fields | `Decorated` in blocks |
| Motion tokens, reveal, hover | `theme.motion` | Chrome `entrance`, element `hover` | stylekit base CSS |
| Page transitions | `theme.motion.transitions` | page meta override | storefront `PageTransition` |
| Effects (snow, particles, grain, aurora) | `theme.effects` | Chrome `effect`, page meta | storefront effects island |
| Nav patterns | SiteHeader `pattern` | `theme.motion.nav` | SiteHeader + nav island |
| Media modifiers (mask, aspect, hover) | Image/Video fields | | blocks |

Before adding a feature, name its row. If no row fits, add a row here and in the plan first,
then build it. Never add the same idea as a per-block field in two places.

## Adding a concept

1. Schema in `@qubo/stylekit` (`schema.ts`) with defaults that keep existing themes unchanged.
2. Presets are arrays of `{ id, label, ... }`; documents reference `id`. Built-in presets are
   derived from palette roles and Brand so they recolour per scheme and per customer.
3. Field kind in `@qubo/blocks` `core/fields.ts` so Zod, Puck and the AI JSON schema all come
   from one declaration.
4. Editor control in `apps/qubo-admin/components/studio/` (theme panel tab or field control).
5. Runtime: CSS first. Client JavaScript only as an island, lazy, paused off screen, and off
   under `prefers-reduced-motion` and `theme.motion.profile = "none"`.
6. A `bun test` for the schema round trip and a Playwright check of the control.

## Designing a customer site

1. Load `landing-page-design` for structure and copy, `humanizer` for every sentence.
2. Brand first: logos, favicon, OG image, voice. Then palette and schemes, then type.
3. Pick at most one signature move per page (a decorated word, a transition, a seasonal
   effect, an edge shape). Restraint reads as quality.
4. Use real photos of the business. Masks and edges give stock-free pages character.
5. Every locale gets its own decor ranges and its own copy.

## Taste review (run before showing a page)

Fails the review unless the customer asked for it:

- pure `#fff` page background, purple on black, neon or default pastel palettes
- gradients on every surface, rainbow accents, glow orbs, dot grids
- Inter, Geist or Space Grotesk as the display font
- one soft radius on everything, a drop shadow on every card, liquid glass
- three icon cards in a row as the only argument, bento grids, terminal windows
- emoji, sparkle icons, checkmark bullet lists, animated arrows
- hover animation on everything, entrance animation on every element
- generic testimonials without a name and context, three pricing tiers by reflex
- copy with em-dashes, "not X, it's Y", "elevate", "seamless"
- no privacy policy or terms, no skeleton loading states, no real product or work photos

The theme Doctor flags the ones it can detect (font choice, white background, contrast).

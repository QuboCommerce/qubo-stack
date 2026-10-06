---
name: qubo-storefront-rendering
description: How the storefront turns Puck documents into pages (templates, section groups, blocks, theme, data loading, SEO, revalidation). Use when adding a block, a template kind, a route or changing how a site renders.
---

# Storefront rendering

`apps/qubo-storefront` serves every site from one Next app; the site comes from the request
host (see `qubo-hosts-and-urls`).

## Data model

- `document` holds Puck JSON (`draft_data`, `published_data`), kinds: template, page,
  section group. `template` maps a kind (`home`, `product`, `collection`, `collection_list`,
  `search`, `cart`, `account`, `not_found`, ...) to a document per site. `section_group`
  holds header and footer.
- Public read API: `GET /v1/render/layout` (site, header, footer, theme) and
  `GET /v1/render/pages/*` in `packages/api/src/routes/studio.ts`. Client methods
  `getLayout`, `getTemplate`, `getPage` in `@qubo/storefront`.

## Render path

`lib/render.tsx` composes header + body + footer into one Puck document and injects the
theme once (`themedRoot`). `loadBlockData` fills data-driven blocks before render
(ProductGrid: `collection` / `manual` / newest; prices via `Intl.NumberFormat` with the
site locale and currency). `viewMetadata()` sets title (`<page> | <site title>`), description,
OpenGraph, `metadataBase`, robots. `lib/seo.tsx` builds the JSON-LD (`siteLd` in the layout,
`productLd` / `breadcrumbLd` on routes) from `sf.seo` and `sf.business` (Settings > Business & SEO).
Routes under `app/sites/[site]/` use the `templateRoute(kind)` factory.

## Adding a block

1. Define it in `packages/blocks/src/library/...` with `cx()`/`gap()`/`typeSize()` from
   `shared.tsx`; class names come from `CSS_PREFIX` (`qb-`), never typed by hand.
2. Styles in `packages/blocks/src/library/styles.ts`.
3. If it needs data, add a loader branch in `loadBlockData` keyed by block type.
4. Test in `packages/blocks/src/test/` (`bun test`) and render it on
   `https://hm-froid.dev.by-ali.dev`.

## Theme

`@qubo/stylekit`: `defineTheme` validates, `compile` emits `--qb-*` custom properties. The
storefront validates the published theme JSON on every layout fetch.

## SEO and cache

Dev hosts render `noindex`. Publishing calls `notifyRevalidate` (`packages/studio/src/revalidate.ts`)
which POSTs to `QUBO_REVALIDATE_URL` signed with `x-qubo-signature` (HMAC of
`QUBO_REVALIDATE_SECRET`). Sitemap and robots are per host.

## Draft vs published

`studio.renderableDocument(siteId, id, locale, { draft })` and `publishedPage(..., { includeDrafts })`
are the only switches. `draft` is true solely when the API's `previewGranted()` accepted the
`x-qubo-preview` header (see qubo-hosts-and-urls → Preview hosts). Never add another path that
serves `draft_data` anonymously.

---
"@qubo/blocks": minor
"@qubo/studio": minor
"@qubo/api": patch
"@qubo/storefront": patch
"qubo-storefront": minor
"qubo-admin": minor
---

Page blueprints, a Pages admin and a SiteTree block.

`@qubo/blocks/presets` exports a page blueprint registry: legal notice,
privacy policy, terms, delivery and payment, warranty and after-sales,
about, contact, site map and FAQ, each with a title, slug and meta
description in fr-BE, nl-BE and en, a starter document, and the modules it
needs. `suggestPages()` returns what a site may still add given its
capabilities and existing slugs.

The admin gains Online store > Pages: the list of pages with publish state,
open in Studio and delete, plus a "Suggested pages" panel grouped by
company, legal, shop and utility. Blueprints whose module is off show a
link to Settings instead of an Add button. "New page" offers the same
choices plus a blank page. Creating a page lands in the Studio.

`SiteTree` is a new data-driven block that renders home, published pages
and the category tree from the sitemap, so a readable site map never
drifts from `/sitemap.xml`. `/render/sitemap` now returns page titles and
`createPage` accepts a starter document and meta title.

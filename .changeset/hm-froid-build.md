---
"@qubo/blocks": minor
"@qubo/stylekit": patch
"@qubo/api": patch
"@qubo/storefront": patch
"qubo-storefront": minor
---

HM Froid site build and the blocks it needed.

`CollectionHeader` is a new data-driven block: breadcrumb, description,
product count of the whole subtree and the child shelves of a collection,
with an `allTitle` for `/collections/all`. `SiteHeader` gains
`accountLabel` (a labelled account button) and `stacked` (logo, search and
actions on the first row, the menu on its own row below, for long menus on
laptops). Thirteen icons were added to the curated set.

`/v1/catalog/categories` now returns `description` and `productCount`, and
`?category=` on `/v1/catalog/products` covers the whole subtree. The
storefront sentence-cases shouting category names and lowercase product
names (`tidyName`) in titles, cards, breadcrumbs and JSON-LD, and related
products on a product page fall back to the product's own shelf.

The Inox theme loses its blue tint: neutrals are near zero chroma, the
paper scheme uses a graphite primary and cobalt stays for links, eyebrows
and the focus ring. `scripts/sites/hm-froid.ts` builds the whole HM Froid
site (theme, header, footer, templates, sixteen pages) and is the
reference for scripted site builds.

---
"@qubo/blocks": minor
"@qubo/shared": minor
"@qubo/studio": minor
"@qubo/storefront": minor
"@qubo/api": patch
---

Languages on the storefront.

The primary language serves at the root and every other published
language under its own prefix (`/nl/...`). Pages in another language use
translated slugs, titles and descriptions stored as `page:<id>`
translation rows; site meta title and description under `site:<id>`; the
document root title is translatable. Blocks prefix every link through
`localHref`, the site header gains a language switch, and `<html lang>`,
`hreflang` with `x-default`, sitemap `xhtml:link` alternates and per
language robots rules follow the served language. `@qubo/shared` adds
`locale-url` helpers (`localizePath`, `splitLocalePath`).

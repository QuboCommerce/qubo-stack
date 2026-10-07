---
"@qubo/blocks": minor
"@qubo/stylekit": minor
"qubo-admin": minor
"qubo-storefront": patch
---

Section kits, and HM Froid rebuilt as the `chapters` kit.

A theme can turn on a section kit (`theme.kits`): a block family with its
own ported CSS, line icons and runtime. The first kit, `chapters`, is a
Puck replica of the Cobalt Chapters landing page; its blocks are hidden
from the Studio's Add section dialog unless the theme lists the kit.
Kit themes load every declared Google font weight. Fixes protocol-relative
`//path` links on the primary language (`basePath` was `/`) and home
anchors under a language prefix.

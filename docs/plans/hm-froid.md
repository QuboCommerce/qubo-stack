# Plan: HM Froid (ds6) and the site lifecycle features it needs

Status: proposed 2026-10-06. Follows `design-system.md` (ds0 to ds5 merged). Pauses the
core roadmap again; p5-p8 stay queued. Target: a professional HM Froid site that a Brussels
restaurateur, butcher or baker finds when they search for equipment, built only with concepts
that exist in the editor, plus the Qubo features the build exposed as missing (page
blueprints, legal pages, site delete and recycle bin).

Related: `core-platform.md` (hreflang, products fix), `qubo-design-language` skill,
`landing-page-design` skill, `humanizer` skill.

## 0. Opinions asked for

### 0.1 Where is the theme code? Is a Puck site portable?

There is no file-based theme and that is fine. What exists:

- The theme is JSON validated by `@qubo/stylekit` (`ThemeSchema`). The built-in themes are
  readable TypeScript (`packages/stylekit/src/themes/hm-froid.ts`): that file is already the
  human-readable form of a theme.
- Each page, template, header and footer is one Puck `Data` document (JSON): `root.props`
  plus a `content` array of `{ type, props }`. Puck has no export format beyond this JSON,
  and it needs none; the JSON plus the block registry is the whole definition.

So the "code" is data, and the Studio sections tab is the file explorer. What is missing is a
portable bundle and a readable view of it. Proposal, after HM Froid ships (one session):

- **Site bundle** (`@qubo/studio` `exportBundle` / `importBundle`): a folder or zip with
  `qubo.json` (bundle version, site type, capabilities), `theme.json`, `documents/<kind>/<handle>.json`,
  `pages.json` (slugs, titles, meta), `navigation.json`, `assets/` plus a manifest. Diffable
  in git, importable into another Qubo install, usable as a backup and as a "duplicate site".
- **Code view** in the Studio: read-only JSON of the current document and theme, with copy
  and download. No in-browser IDE. Editing stays in the UI and later through the AI, which
  patches the same JSON.
- A theme marketplace or a theme-only export is the same bundle with `documents/` empty.

What not to build: a Liquid-style schema language, or a VS Code clone. The Puck JSON plus
the block schema the AI already receives is a better contract than a template language.

### 0.2 Legal and suggested pages

Pages are not forced by preset; they are **suggested** by the modules a site has. Concept:
`page blueprints`, a registry in `@qubo/blocks` (`presets/page-blueprints.ts`):

```ts
{ id: "privacy", category: "legal", suggestedFor: ["*"], required: false,
  slug: { "fr-BE": "politique-de-confidentialite", nl: "privacybeleid", en: "privacy-policy" },
  title: { ... }, starter: (ctx) => PuckData }
```

Categories: `legal` (mentions légales, politique de confidentialité, conditions générales),
`commerce` (livraison et paiement, garantie et SAV), `company` (qui sommes-nous, contact,
équipe), `utility` (plan du site, FAQ). `suggestedFor` lists capabilities; `commerce`
blueprints only appear when the site has the shop module, and a blueprint whose capability
is missing shows as "Needs the Shop module" with a link to Settings. Delivery and payment is
one page; if a site has no physical delivery the page simply omits the delivery block.

Plan du site becomes a block (`SiteTree`) that renders collections, pages and blog from data,
so it never goes stale. Contact stays a suggestion.

### 0.3 Deleting sites

Draft sites can be deleted from the Sites page. Deletion is soft (`site.deleted_at`): the
site moves to a recycle bin at the bottom of the Sites page, is purged after 60 days, and can
be restored or purged early. Deleted sites stop resolving on every host and disappear from
every list; their slug and domains stay reserved until purge. Published sites keep the extra
guard: delete requires typing the site name and is a later step (not in ds6).

Purge needs a clock. `packages/api/src/server.ts` already runs the inbox, triage and domain
sweeps on intervals; the daily purge joins them, so a customer VPS needs no cron entry.

## 1. HM Froid: what we know and what we assume

Source material (customer data, never copied into docs): `.private/legacy-archive/2026-09-18/`
is a full crawl of hmfroid.be. `manifest.json` maps each URL to a file under `public/pages/`;
the old info pages (garantie, livraison/retrait, mentions légales, conditions, coordonnées,
qui sommes-nous) carry real text to rewrite from, not placeholders. `exports/` and
`../migration-output/2026-09-18/` hold the product and customer data behind the import.

Facts from hmfroid.be and the import (do not invent beyond these):

- Legal entity on the old site: H.M. Catering Equipment s.a. Shop: Avenue Raymond
  Vanderbruggen 18-20, 1070 Anderlecht (Bruxelles). Phone +32 2 411 80 02.
- Sells and buys **new and used** horeca equipment: grandes cuisines, snack, restaurant,
  boucherie, poissonnerie, friterie, pizzeria, boulangerie, pâtisserie. The old site says
  "about 5000"; we imported 3949 with 3946 photos, so the copy says **"plus de 3 900
  produits"** (exact and more credible than a round number; thin space per French
  typography). No descriptions yet (products fix, separate job).
- Brands carried: Bertos, MBM, Robot Coupe, Tefcold, Hällde, Henkovac, Santos, Dexion,
  Angelo Forni, Broaster, Da Venix, Gargano, Kisag, Knox, Modular, Potis, Ronda, Vulcan,
  Wooster.
- Catalogue structure: Froid commercial (largest, 785 products), Préparation, Cuisson, Fours,
  Rôtissoire et gyros, Inox neutre, Ventilation, Lavage, Balances, Grill et toaster,
  Cafétéria et bar, Pizzeria et pasta, plus Occasions, Promotions, Déstockage, Liquidation.

Answers from Ali (2026-10-06), used as facts from here on:

1. Founded in **2008**. The dev hero's "2006" is wrong.
2. Services: sale of new and used equipment, **delivery**, **after-sales repair (SAV)**,
   **rachat** of used equipment. **No installation claim** anywhere in the copy.
3. Opening hours: **Lun-Ven 9h-18h, Sam 10h-16h**. Walk-ins welcome.
4. Payments: not wired yet. The product needs a provider abstraction (Stripe, Mollie, Polar)
   as its own plan, not here. For the copy, name the methods that fit a 2 000 to 15 000 EUR
   purchase and that Mollie exposes natively in Belgium: **virement bancaire** (the default
   for pro buyers, with an invoice), **Bancontact**, **Visa / Mastercard**, **Apple Pay**.
   Klarna and other instalment schemes are left out until a provider is live; a "paiement
   en plusieurs fois" promise we cannot honour is worse than silence. The Livraison et
   paiement page shows methods as a list that comes from site settings, so wiring a
   provider later changes the data, not the page. VAT number: still TODO, left blank with a
   visible placeholder in the legal drafts.
5. Images: Ali generates the hero and section visuals. Build stops before ds6e until they
   land; everything that does not need imagery (theme, SEO, pages registry) goes first.
6. Languages: **French and Dutch** (fr-BE default, nl-BE second). Flemish register: local
   and professional, playful where the French is playful, no forced wordplay. Translation
   overlays already exist in `@qubo/studio`; the storefront still needs locale routing, so
   Dutch is phase ds6g below rather than out of scope.

No testimonials, counters or certifications appear on the site unless Mostapha supplies them.

## 2. SEO: pages the demand asks for

Method: Google autocomplete, `hl=fr gl=be`, on 27 seed terms (2026-10-06). Patterns:

- Belgians type **frigo professionnel**, not armoire réfrigérée; **occasion** is attached to
  nearly every term (frigo, chambre froide, vitrine, table réfrigérée, lave-vaisselle,
  friteuse, matériel horeca); city modifiers **bruxelles**, **anderlecht**, **belgique**.
- Strong Belgium-specific terms: friteuse professionnelle pour friterie, matériel friterie
  belgique, matériel boucherie belgique, hotte professionnelle belgique, grossiste horeca
  bruxelles, table inox horeca.
- Brand intent exists: robot coupe belgique, lave vaisselle professionnel diamond/hobart.
- "hm froid anderlecht" is already a query.

Page map (fr-BE slugs; the URL carries the keyword, the H1 repeats it in plain French):

| URL | Role | Primary term |
| --- | --- | --- |
| `/` | home | matériel horeca bruxelles, frigo professionnel |
| `/collections/<handle>` | 13 top categories, renamed to the searched term (products fix) | frigo professionnel, chambre froide, vitrine réfrigérée, table réfrigérée, machine à glaçons professionnelle, lave vaisselle professionnel, friteuse professionnelle, four pizza professionnel, hotte professionnelle, table inox, plonge inox, trancheuse professionnelle |
| `/materiel-horeca-occasion` | page: used stock, how it is checked, rachat | matériel horeca occasion bruxelles |
| `/rachat-materiel-horeca` | page: we buy your equipment, form | rachat matériel horeca |
| `/friterie` `/boucherie` `/restaurant` `/boulangerie-patisserie` | 4 trade pages that curate collections for one trade | matériel friterie belgique, matériel boucherie belgique |
| `/marques` and `/marques/<brand>` | brand index (collection by brand) | robot coupe belgique |
| `/livraison-et-paiement` | commerce blueprint | |
| `/garantie-et-sav` | commerce blueprint | |
| `/qui-sommes-nous` | company blueprint | hm froid anderlecht |
| `/contact` | company blueprint: map, hours, access, form | matériel horeca anderlecht |
| `/mentions-legales` `/politique-de-confidentialite` `/conditions-generales` | legal blueprints (the terms blueprint titles itself "Conditions générales de vente" when the site sells) | |
| `/plan-du-site` | utility blueprint, `SiteTree` block | |

Structured data (storefront, once, for every site): `LocalBusiness` (or `Store`) with
address, phone, hours, geo; `Product` with offer and availability; `BreadcrumbList`;
`Organization` with logo. Title pattern `<Page> | HM Froid, matériel horeca à Bruxelles`.
Trade pages and brand pages are regular pages built from `ProductGrid` and `CardGrid`, so
they need no new route.

## 3. Direction artistique: "Inox"

Replace Arctic. The catalogue is 90 percent stainless steel, so the site takes its material
from the product: polished steel, graphite black, paper white, and the old blue kept as an
undertone in the steel highlights and as the single accent.

- **Palette.** `steel` (oklch 0.82 0.008 240), `steel-dark` (0.62), `chrome-light` (0.94),
  `graphite` (0.2 0.012 250) for text and dark bands, `paper` (0.975 0.004 230, not pure
  white), `cobalt` accent (0.47 0.17 258) for buttons, links and status only. Steel is never
  flat: it is only ever a gradient preset.
- **Surfaces.** Two new built-in gradient presets derived from the palette: `brushed`
  (linear, 6 stops, tight light-dark alternation at 100 to 105 degrees) and `polished`
  (conic, two highlight sweeps). Plus a new surface kind, `texture`, with one built-in,
  `brushed-lines`: a `repeating-linear-gradient` of 1px lines at 3 to 4 percent alpha layered
  over any background. Steel appears in at most three places per page: the hero plate, the
  product-card hover sheen, and the CTA band.
- **Shape.** Radius 3, border 1, no drop shadows on cards; one inset highlight line on steel
  surfaces (`inset 0 1px 0 rgba(255,255,255,.5)`) sells the metal. Buttons: `plate` preset,
  radius 3, uppercase accent type, hover darkens.
- **Type.** Display and headings: Barlow Condensed 600, uppercase, tracking 0.01 (DIN
  lineage, reads like an equipment nameplate). Body: Barlow 400. Accent: Barlow 600 uppercase
  tracking 0.1. No Inter.
- **Motion.** Profile `subtle`, entrance `rise`. One signature move on the home page: the
  hero. Nav: header pattern with mega menu for the 13 categories; "Mon profil" button in the
  header (accounts capability is on).
- **Hero experiment (go/no-go on a screenshot).** A `SteelReveal` hero: a two-door armoire
  drawn from the brushed and polished surfaces (no image), pinned for 150vh; as the visitor
  scrolls the doors rotate open on `animation-timeline: view()`, the headline and CTA rise
  from inside, then the next section covers it. Pure CSS scroll-driven animation, static open
  state under reduced motion and on browsers without the timeline. If the CSS steel does not
  read as metal in the first screenshot, the fallback is a split hero with a real product
  cut-out on a steel plate and a parallax of 10 percent. Budget: half a session.
- **Copy.** fr-BE, plain, concrete, present tense, no superlatives, humanizer pass on every
  string. The home argues in this order: what we sell and to whom, the Froid commercial range
  with real products, new or used (with rachat), the trades we serve, how to buy (visit,
  call, order, delivery), brands, contact. No stats band, no testimonials, no icon triad.

## 4. Phases

| Phase | Scope | Gate |
| --- | --- | --- |
| ds6a-sites (done 2026-10-06) | `site.deleted_at`, delete draft from Sites page (trash icon left of Transfer, confirm dialog), recycle bin section with days left, restore and purge, daily 60-day purge in the API, every site query excludes deleted, "Move" renamed "Transfer" (the trailing ellipsis read as truncation) | Playwright: delete, bin, restore, purge; storefront 404 for a deleted site's host |
| ds6b-pages (done 2026-10-06) | page blueprints registry, Create page dialog on `/online-store/pages` (the nav link exists, the page does not), categories legal, commerce, company, utility, capability gating with link to modules, `SiteTree` block, `/plan-du-site` | bun test for blueprints; Playwright create from blueprint |
| ds6c-theme (done 2026-10-06) | Inox theme in stylekit (replaces Arctic as the `business` default and the HM theme), `texture` surface kind, `brushed` and `polished` gradients, `plate` button, Barlow fonts | schema tests; theme doctor passes; screenshot of the theme on the current pages |
| ds6d-seo (done 2026-10-06) | `LocalBusiness`, `Product`, `BreadcrumbList`, `Organization` JSON-LD in `viewMetadata` / render; title pattern; sitemap includes collections and pages | curl the HTML, validate with the schema.org validator |
| ds6e-build (done 2026-10-06) | header, footer, home, occasions, rachat, 4 trade pages, brands, contact, qui sommes-nous, livraison et paiement, garantie et SAV, 3 legal, plan du site; product and collection templates restyled; copy humanized; **waits for Ali's images** | taste review from `qubo-design-language`; Lighthouse SEO 100, a11y 95+; Ali review |
| ds6f-hero (done 2026-10-06, go) | `SteelReveal` experiment | screenshot go/no-go |
| ds6h-cobalt (done 2026-10-07) | replica of the Manus "Cobalt Chapters" landing page (I11) as the `chapters` section kit: 13 blocks, ported CSS, runtime, line icons, theme kit assets; header, home and footer rebuilt from `hm-froid.chapters.ts`; Dutch for all of it | desktop 1440 and mobile 390 screenshots match the reference height (8897 px desktop); menu, tabs, carousel, FAQ, partner drift checked in Playwright; Studio renders the kit |
| ds6g-locale (done 2026-10-06) | storefront locale routing (`/nl/...` prefix for non-default locales, `<html lang>`, `hreflang` and `x-default` in sitemap and head, locale-aware URL helpers in `@qubo/shared`), Dutch overlays for every HM page and the header/footer, nl-BE product and collection names where the catalogue has them, language switch in the header | Playwright: `/nl/` renders Dutch, `/` renders French, hreflang pairs validate; native-register review of the Dutch copy |

Order: ds6a, ds6c, ds6d, ds6b, ds6e, ds6f, ds6g. ds6c before ds6b so the Create page dialog is
seen in the new theme only on the storefront (the admin is unaffected). ds6e cannot start before
Ali's images arrive; if they are late, ds6g's routing half runs first and the Dutch copy follows
the French. Products fix (descriptions, duplicate roots, category slugs) runs in parallel as its
own plan and is a prerequisite for the collection pages to rank; the trade pages work without it.

Effort: ds6a one session; ds6b one; ds6c half; ds6d half; ds6e two; ds6f half; ds6g one.

## 4a. Cobalt Chapters: what the replica left out

- The WebGL "metal light" shader on the steel interlude; the section keeps the parallax.
- The Manus cookie consent mock and the "Versions" explorer (prototype tooling).
- Kit media is uploaded by the build script from `ref-material/manus-landingpage/`, which is
  outside the repo; a rebuild on another machine needs that folder or the assets already in the
  media library (matched by file name).
- The other HM pages still use the Inox theme blocks; they share the chapters header and footer.

## 5. Out of scope here

Payment provider abstraction (Stripe, Mollie, Polar; own plan), onboarding flow, the site
bundle export (0.1), deleting published sites, Shopify-style theme file editor.

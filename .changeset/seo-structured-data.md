---
"@qubo/db": minor
"@qubo/api": minor
"@qubo/storefront": minor
"qubo-storefront": minor
"qubo-admin": minor
---

Structured data and a Business & SEO settings page.

Settings gains "Business & SEO": site title and description, phone, email,
schema.org business type, map coordinates, weekly opening hours, and the
organisation's legal identity (name, company and VAT numbers, address).
Site settings store the new contact fields (migration 0019).

The storefront titles every page as "Page | Site title" (the home page uses
the site title alone, or its own Studio title), falls back to the site
description, and emits JSON-LD built only from what was entered:
Organization, WebSite and the located business on every page; Product with
Offer or AggregateOffer on product pages; BreadcrumbList on products,
collections and pages. The layout endpoint returns `seo` and `business`,
and product detail now carries its meta fields and categories.

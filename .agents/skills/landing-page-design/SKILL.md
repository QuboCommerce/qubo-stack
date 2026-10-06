---
name: landing-page-design
description: "Page strategy and conversion copy for a Qubo site page: intake, section order, headline and CTA writing, proof placement, SEO intent, content realism and ship checklist. Use when planning or writing a site page (home, landing, offer, service) for a customer site. Visual values come from the Qubo theme, see qubo-design-language."
license: MIT
---

# Landing page design (adapted for Qubo)

Adapted from `elayadesign/ai-design-skills` (MIT). The original Part B (fonts, Tailwind scale,
spacing table, glass nav, gradient hero text) is replaced: on Qubo every visual value resolves
through the site theme and block presets. Load `qubo-design-language` for that half, and
`humanizer` for every sentence that ends up on a page.

A landing page wins one intent: **one offer, one audience, one primary action.** A home page
may serve several, but each section still has one job.

## 1. Intake

Gather before designing. Ask only for what is missing, in one batch.

- **Purpose**: the one primary action (call, book, quote request, buy, visit), what the visitor
  gets, what counts as a conversion.
- **Audience**: who they are, the problem they bring, the top three reasons they do not convert
  today, where they come from (ads, search, social, email), what they already know.
- **Proof and assets**: real photos of the work, logos, numbers, reviews with names, certificates,
  guarantees, refund or cancellation terms.
- **Constraints**: voice (formal, plain, warm), languages the site runs in, mobile share.

If the customer cannot answer, assume, state the assumption in one line, continue. Never invent
proof: numbers, names, reviews and certificates come from the customer or are left out.

## 2. Page structure

Above the fold:

1. Headline: outcome plus audience.
2. Subheadline: how, with one specific detail.
3. Primary CTA: verb plus what they get.
4. One proof signal: a real number, a known client logo, or a short named review.
5. Hero visual: real photo or video of the product, place or work. Stock only as last resort.

Middle (the argument): problem to solution, three to five outcome benefits, how it works in
steps, proof next to the claim it supports, one large statement section (a tagline or the core
promise set big, away from the hero).

Bottom (objections): FAQ with six to twelve real questions, risk reversal, a final CTA that
matches the top.

## 3. Layout types

Pick one and say why.

| Type | Use when |
| --- | --- |
| Classic hero plus sections | the offer is clear from one picture |
| Long form story | the visitor must be educated or reassured |
| Minimal conversion | high intent traffic or a single short offer |
| Comparison | search intent is "X vs Y" or "best for" |

## 4. Conversion rules

- Mirror the ad or search promise in the hero when traffic is paid.
- One primary CTA above the fold. No competing buttons.
- Benefit first: what it means for them, then the feature that delivers it.
- Be specific: "Installed and running within 48 hours in Brussels" beats "fast service".
- Reduce risk with at least one of: free quote, guarantee, clear pricing, cancel anytime.
- Objections are a section, not a footnote.

## 5. Copywriting

- Headline patterns: "{Outcome} without {pain}", "The {category} for {audience}",
  "{Result} in {time}". Use them as a starting point, then make it sound like the business.
- Subheadline: one or two sentences, what it is and who it is for.
- CTA: verb plus object ("Request a quote", "Book a visit"). Never "Learn more" or "Submit".
- Benefit items: a short plain label, then the detail in the same sentence. No bold labels
  stacked as a list (a humanizer tell).
- Sentence case headings. Active voice. No exclamation marks in confirmations, no "Oops".
- No AI vocabulary: elevate, seamless, unleash, next gen, game changer, delve, tapestry, "in the
  world of", "not X, it's Y".
- Translate meaning, not words: every locale gets copy written for that language.

## 6. Build order

Hero, benefits, how it works, proof, FAQ, final CTA. Section by section; never regenerate the
whole page to change one part.

## 7. SEO and AEO

- Index evergreen pages whose search intent matches the promise; `noindex` short campaign pages.
- Title and meta description per locale, internal links from home and service pages, FAQ in
  plain question and answer form (FAQ structured data is emitted by the Faq block).

## 8. Content realism

- No lorem ipsum, no "John Doe", no placeholder brands.
- No round fake numbers. Real numbers only, from the customer.
- Varied dates on posts, unique avatars or none.

## 9. Ship checklist

- [ ] One offer, one audience, one primary action per page
- [ ] Proof next to the claim it supports, all of it real
- [ ] Every CTA links somewhere real; current page marked in the navigation
- [ ] Privacy policy and terms linked in the footer, a branded 404
- [ ] Title, description, OG image, favicon set (Brand tab)
- [ ] Alt text on every meaningful image, in every locale
- [ ] Copy passed through `humanizer`, design passed through the `qubo-design-language` review

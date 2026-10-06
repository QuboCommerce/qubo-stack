---
"@qubo/stylekit": minor
"@qubo/blocks": minor
"qubo-admin": patch
---

HM Froid Inox theme and the stylekit features it needs.

The hm-froid theme is rewritten from the Arctic look to a brushed steel look
(same id, so provisioning and documents keep working): cobalt accent, paper
and plate schemes, a graphite dark scheme, Barlow Condensed display type,
3px radii and an inset plate-edge shadow. Steel is never a flat grey: it only
appears through gradients.

Stylekit gains a `stripes` gradient kind (a repeating linear gradient with a
pixel period) and a built-in `brushed-lines` gradient, plus an `inset` flag on
shadows. Section chrome in blocks gains a `texture` field so a second gradient
layer can sit on top of the main background. The Studio theme editor exposes
the new kind (Period slider) and the inset toggle.

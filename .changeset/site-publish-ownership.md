---
"qubo-admin": minor
"@qubo/api": minor
"@qubo/db": minor
---

Sites are drafts until published. Drafts are hidden from the public storefront (staff and the preview PIN still see them) and can move freely between organisations you manage, with their media and the organisation's fonts. Publishing asks you to confirm the owning organisation; after that the site stays put (assisted migration only). New `site.published_at` column, backfilled for existing sites.

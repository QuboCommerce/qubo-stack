---
"@qubo/inbox": minor
"@qubo/api": minor
"qubo-admin": minor
---

Inbound e-mail: with `EMAIL_INBOUND_DOMAIN` and `RESEND_WEBHOOK_SECRET` set, mail to `<site-slug>@<domain>` lands in that site's inbox and customer replies thread back onto their conversation (reply address, Message-ID references, or sender plus subject). Quoted history is stripped; auto-replies, DMARC failures and duplicates are ignored. The inbox shows each site's inbound address.

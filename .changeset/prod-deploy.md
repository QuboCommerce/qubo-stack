---
"@qubo/domains": patch
"qubo-admin": patch
---

Domain verification works in Docker Compose installs. Compose passes an
unset `QUBO_DNS_SERVERS` as an empty string, which left the verifier
with no DNS servers, so no domain could ever connect. Empty now falls
back to the public resolvers; the same applies to `PORTAL_URL`. Test
files stay out of image builds, and `scripts/backup.sh` takes a nightly
database and media backup.

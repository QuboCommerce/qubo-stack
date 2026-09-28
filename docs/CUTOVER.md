# HM Froid cutover runbook

This runbook deliberately separates data preservation from domain transfer.
Do not change DNS until every pre-cutover gate is checked.

## Current preservation checkpoint

- Private archive: `.private/legacy-archive/2026-09-18`
- Normalized migration output: `.private/migration-output/2026-09-18`
- Public URLs captured: 3,003
- Customers captured: 2,263
- Product source rows: 5,151
- Unique valid product references: 3,949
- Duplicate product rows reported: 1,172
- Invalid product rows reported: 30
- Product images unresolved: 2
- Legacy admin totals: 3,174 active + 991 inactive products, 2,263
  customers, 1,070 orders

The difference between 3,949 unique references and 4,165 admin products must be
reviewed with the duplicate/invalid reports before final cutover. Do not invent
or silently merge the remaining 216 records.

## Required credentials and values

- Domain registrar access or EPP/transfer code
- Complete DNS zone, especially MX, SPF, DKIM and DMARC records
- Production VPS SSH access
- Stripe live secret and webhook secret, with Bancontact enabled
- Resend API key and a verified sender domain
- Confirmed shipping prices or rules
- Confirmed company identity, VAT number, address, telephone and legal text
- Mostapha's production administrator email

## ShopApplication continuity request

Send only after the private archive has been copied to a second independent
location:

> Bonjour,
>
> Dans le cadre de notre plan de continuité, pourriez-vous nous transmettre le
> code de transfert/EPP du domaine hmfroid.be, la zone DNS complète (y compris
> les enregistrements liés aux e-mails), ainsi qu'une archive des médias et
> fichiers actuellement hébergés ? Merci également de confirmer si un accès
> FTP/SFTP existe pour notre compte.
>
> Nous vous remercions de ne procéder à aucune résiliation, modification DNS ou
> interruption de service sans confirmation écrite de notre part.

## Staging acceptance

1. Restore a fresh PostgreSQL database using committed Drizzle migrations.
2. Run `pnpm legacy:import` and review the reconciliation report.
3. Run the importer with `--apply`; run it again and confirm counts do not
   change.
4. Mount the archived product directory as `LEGACY_ASSET_ROOT`.
5. Confirm representative products from every major category, including
   reseller pricing and unavailable stock.
6. Complete a low-value Stripe card transaction.
7. Complete a low-value Bancontact transaction.
8. Replay each Stripe webhook and confirm only one order/payment exists.
9. Confirm order email delivery and panel status changes.
10. Test catalogue, cart and checkout on mobile Safari, Chromium and Firefox.

## DNS cutover

1. Copy the private archive to independent encrypted storage and verify hashes.
2. Secure registrar access and export the current DNS zone.
3. Lower web-record TTL to 300 seconds at least one TTL window before cutover.
4. Do not alter MX/SPF/DKIM/DMARC records.
5. Put ShopApplication catalogue changes on a short freeze.
6. Generate fresh exports and run the idempotent importer one final time.
7. Point only the website records to Caddy.
8. Verify TLS, canonical redirects, checkout webhook reachability and email.
9. Keep the legacy host and the previous DNS values available for rollback.

## Rollback triggers

Roll back website DNS if any of these persist beyond 15 minutes:

- Checkout cannot create a paid order
- Stripe webhooks cannot reach or verify against production
- Product prices materially disagree with the approved reconciliation
- The primary catalogue or product media is unavailable
- Existing business email delivery is affected

DNS/domain changes and real payment acceptance require explicit owner approval.

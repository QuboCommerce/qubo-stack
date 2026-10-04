-- One organisation per legal entity (2026-10-04). Idempotent; safe to re-run.
-- HM Froid and TailG used to share the import org "Wooster". They are two companies:
--   H.M. CATERING EQUIPEMENT SA  BE 0859.752.174  → site hm-froid
--   TLG-BELGIUM SRL              BE 0655.678.923  → site tailg-belgium
-- Source: KBO/BCE public search. Mostafa Hilal is director of both and OWNER of both orgs.
-- Ids: the HM org keeps the stable import id (stableUuid("organization","wooster")).
-- TailG org id = uuid v5-style constant so every environment converges on the same row.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/split-mostapha-orgs.sql
begin;

update organization set
  name = 'H&M Catering Equipement', slug = 'hm-catering',
  legal_name = 'H.M. CATERING EQUIPEMENT', legal_form = 'SA', company_number = '0859.752.174', vat_number = 'BE0859752174',
  address_line1 = 'Avenue Raymond Vander Bruggen 18-20', postal_code = '1070', city = 'Anderlecht', country = 'BE', updated_at = now()
where id = (select organization_id from site where slug = 'hm-froid');

insert into organization (id, name, slug, legal_name, legal_form, company_number, vat_number, address_line1, postal_code, city, country, created_at)
values ('7c1f0a52-5d4e-5b8a-9a51-0655678923ab', 'TLG Belgium', 'tlg-belgium', 'TLG-BELGIUM', 'SRL', '0655.678.923', 'BE0655678923',
        'Avenue Raymond Vander Bruggen 18-20', '1070', 'Anderlecht', 'BE', now())
on conflict (id) do update set name = excluded.name, slug = excluded.slug, legal_name = excluded.legal_name, legal_form = excluded.legal_form,
  company_number = excluded.company_number, vat_number = excluded.vat_number, address_line1 = excluded.address_line1,
  postal_code = excluded.postal_code, city = excluded.city, country = excluded.country, updated_at = now();

-- Every owner of the HM org also owns TLG (today: Mostapha).
insert into organization_member (organization_id, user_id, role)
select '7c1f0a52-5d4e-5b8a-9a51-0655678923ab', m.user_id, 'OWNER'
from organization_member m join site s on s.organization_id = m.organization_id
where s.slug = 'hm-froid' and m.role = 'OWNER'
on conflict (organization_id, user_id) do update set role = 'OWNER';

update site set organization_id = '7c1f0a52-5d4e-5b8a-9a51-0655678923ab', updated_at = now() where slug = 'tailg-belgium';
update asset set organization_id = '7c1f0a52-5d4e-5b8a-9a51-0655678923ab'
where site_id = (select id from site where slug = 'tailg-belgium');

commit;

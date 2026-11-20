---
name: qubo-i18n
description: UI translations in the Qubo admin (next-intl, English source of truth, French). Use when adding or changing any user-visible string, error message, label, title or toast in apps/qubo-admin.
---

# Admin i18n

next-intl without locale routing. Languages: `en` (source) and `fr`. Never hardcode a
user-visible string in `apps/qubo-admin`. Write English first, then French.

## Where things live

- `messages/en/<area>.json` and `messages/fr/<area>.json`: one file per area, each holding
  one or more top-level namespaces (`products`, `settings`, ...). `messages/<lang>/index.ts`
  merges them. English is the type source (`global.d.ts`), so a wrong key fails `tsc`.
- `i18n/config.ts` (locales, cookie), `i18n/request.ts` (cookie, then `user.locale`, then
  Accept-Language), `app/language-actions.ts` (`setLanguage`).
- `messages/messages.test.ts` fails when `fr` is missing a key or loses a placeholder.

## Using it

- Server components and actions: `const t = await getTranslations("products")`.
- Client components: `const t = useTranslations("products")`.
- Page titles: `generateMetadata` with `getTranslations`.
- Server action errors: translate in the action (`return { error: t("errors.sku") }`).
- Plurals and counts: ICU, `"count": "{count, plural, one {# product} other {# products}}"`.
  Never build a plural with a ternary.
- Never concatenate sentences. One message per sentence, with `{name}` placeholders.
  Rich text: `t.rich("key", { b: (c) => <strong>{c}</strong> })`.
- Dates, numbers, currency: use `useLocale()` / `getLocale()` for `Intl`, never a fixed
  `"en-US"` or `"en-GB"`.
- Keys are camelCase, grouped by screen then element: `products.list.empty`,
  `products.form.fields.sku`. Reuse `common.*` only for truly generic words (Save, Cancel).
- Navigation labels are keys of `nav` (`NavKey` in `lib/navigation.ts`).
- Not translated: brand names (Qubo, Studio), user content, identifiers, URLs, log
  lines, and machine-facing API responses.

## French style

Formal "vous". Sentence case like English. No em-dashes. Keep the product vocabulary
consistent: produit, commande, client, brouillon, publier, thème, bloc, média, code promo,
boutique en ligne, messagerie, paramètres. Prefer natural phrasing over word for word
translation, and keep strings about as short as the English (buttons and table headers).

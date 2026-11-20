import { parseRules, type CollectionRule, type RuleField } from "@qubo/db/collection-rules";

const FLAGS: RuleField[] = ["onSale", "inStock"];

export type PhraseKey =
  | "categoryIs"
  | "categoryIsNot"
  | "skuStartsWith"
  | "skuContains"
  | "skuEquals"
  | "nameStartsWith"
  | "nameContains"
  | "brandEquals"
  | "brandContains"
  | "priceGte"
  | "priceLte"
  | "onSale"
  | "inStock"
  | "createdWithinDays";

export function phraseKey(rule: Pick<CollectionRule, "field" | "op">): PhraseKey {
  if (FLAGS.includes(rule.field) || rule.field === "createdWithinDays") return rule.field as PhraseKey;
  return `${rule.field}${rule.op[0]!.toUpperCase()}${rule.op.slice(1)}` as PhraseKey;
}

/**
 * One readable line for a set of rules, e.g. "SKU starts with JBM- and on sale". Phrases are
 * whole translated messages joined with `Intl.ListFormat`, so no sentence is concatenated.
 */
export function describeRules(
  raw: unknown,
  match: "all" | "any",
  ctx: {
    locale: string;
    phrase: (key: PhraseKey, values: { value: string; days: number }) => string;
    categoryName: (id: string) => string;
    money: (value: number) => string;
  },
): string | null {
  const rules = parseRules(raw);
  if (!rules.length) return null;
  const parts = rules.map((r) => {
    const value = r.field === "category" ? ctx.categoryName(r.value) : r.field === "price" ? ctx.money(Number(r.value)) : r.value;
    return ctx.phrase(phraseKey(r), { value, days: Math.floor(Number(r.value)) || 0 });
  });
  const text = new Intl.ListFormat(ctx.locale, { type: match === "any" ? "disjunction" : "conjunction" }).format(parts);
  return text.charAt(0).toLocaleUpperCase(ctx.locale) + text.slice(1);
}

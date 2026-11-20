import { sql, type SQL } from "drizzle-orm";

/**
 * Smart collection rules, shared by the admin preview and the storefront API so both see
 * the same products. Conditions are written against the `"product"` table by name, so the
 * caller must select from `product` without an alias.
 */
export const RULE_FIELDS = {
  category: ["is", "isNot"],
  sku: ["startsWith", "contains", "equals"],
  name: ["startsWith", "contains"],
  brand: ["equals", "contains"],
  price: ["gte", "lte"],
  onSale: ["is"],
  inStock: ["is"],
  createdWithinDays: ["lte"],
} as const;

export type RuleField = keyof typeof RULE_FIELDS;
export type RuleOp = (typeof RULE_FIELDS)[RuleField][number];
/** `value` is a category id, text, a price, a day count, or `"true"` for the flag fields. */
export type CollectionRule = { field: RuleField; op: RuleOp; value: string };

export type CollectionSort = "featured" | "newest" | "name" | "price_asc" | "price_desc" | "manual";
export const COLLECTION_SORTS: CollectionSort[] = ["featured", "newest", "name", "price_asc", "price_desc", "manual"];

export type CollectionShape = {
  id: string;
  kind: "smart" | "manual";
  match: "all" | "any";
  rules: unknown;
  sort: CollectionSort;
};

const FLAGS: RuleField[] = ["onSale", "inStock"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps only well-formed rules, trimmed; anything else is dropped rather than thrown. */
export function parseRules(raw: unknown): CollectionRule[] {
  if (!Array.isArray(raw)) return [];
  const out: CollectionRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { field, op, value } = r as Record<string, unknown>;
    if (typeof field !== "string" || !(field in RULE_FIELDS)) continue;
    const f = field as RuleField;
    const ops = RULE_FIELDS[f] as readonly string[];
    if (typeof op !== "string" || !ops.includes(op)) continue;
    if (FLAGS.includes(f)) {
      out.push({ field: f, op: op as RuleOp, value: "true" });
      continue;
    }
    const v = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
    if (!v) continue;
    if (f === "category" && !uuid.test(v)) continue;
    if ((f === "price" || f === "createdWithinDays") && !(Number.isFinite(Number(v)) && Number(v) >= 0)) continue;
    out.push({ field: f, op: op as RuleOp, value: v });
  }
  return out;
}

const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const pattern = (op: RuleOp, v: string) => (op === "startsWith" ? `${like(v)}%` : op === "equals" ? like(v) : `%${like(v)}%`);

function subtree(categoryId: string): SQL {
  return sql`exists (
    with recursive t(id) as (
      select id from category where id = ${categoryId}::uuid
      union select c.id from category c join t on c.parent_id = t.id
    )
    select 1 from product_category pc where pc.product_id = "product"."id" and pc.category_id in (select id from t)
  )`;
}

export function ruleCondition(rule: CollectionRule): SQL {
  const { field, op, value } = rule;
  switch (field) {
    case "category":
      return op === "isNot" ? sql`not ${subtree(value)}` : subtree(value);
    case "sku":
      // Same places the promotions matcher looks: variant SKUs, the imported reference and the legacy id.
      return sql`(exists (select 1 from product_variant v where v.product_id = "product"."id" and v.sku ilike ${pattern(op, value)})
        or "product"."source_snapshot"->>'Référence' ilike ${pattern(op, value)}
        or "product"."legacy_id" ilike ${pattern(op, value)})`;
    case "name":
      return sql`"product"."name" ilike ${pattern(op, value)}`;
    case "brand":
      return sql`"product"."brand" ilike ${pattern(op, value)}`;
    case "price":
      return op === "gte" ? sql`"product"."base_price" >= ${value}::numeric` : sql`"product"."base_price" <= ${value}::numeric`;
    case "onSale":
      return sql`"product"."compare_at_price" > "product"."base_price"`;
    case "inStock":
      return sql`exists (
        select 1 from product_variant v left join inventory_item ii on ii.variant_id = v.id
        where v.product_id = "product"."id" and (ii.id is null or not ii.tracked or ii.quantity - ii.reserved_quantity > 0)
      )`;
    case "createdWithinDays":
      return sql`"product"."created_at" >= now() - make_interval(days => ${Math.floor(Number(value))}::int)`;
  }
}

/** Products in the collection. A smart collection with no valid rule matches nothing. */
export function collectionCondition(c: CollectionShape): SQL {
  if (c.kind === "manual") {
    return sql`"product"."id" in (select cp.product_id from collection_product cp where cp.collection_id = ${c.id}::uuid)`;
  }
  const rules = parseRules(c.rules);
  if (!rules.length) return sql`false`;
  const parts = rules.map(ruleCondition);
  return sql`(${sql.join(parts, c.match === "any" ? sql` or ` : sql` and `)})`;
}

export function collectionOrderBy(c: Pick<CollectionShape, "id" | "kind" | "sort">): SQL[] {
  switch (c.sort) {
    case "manual":
      return c.kind === "manual"
        ? [sql`(select cp.position from collection_product cp where cp.collection_id = ${c.id}::uuid and cp.product_id = "product"."id") asc`, sql`"product"."name" asc`]
        : [sql`"product"."name" asc`];
    case "newest":
      return [sql`"product"."created_at" desc`];
    case "name":
      return [sql`"product"."name" asc`];
    case "price_asc":
      return [sql`"product"."base_price" asc`, sql`"product"."name" asc`];
    case "price_desc":
      return [sql`"product"."base_price" desc`, sql`"product"."name" asc`];
    default:
      return [sql`"product"."is_featured" desc`, sql`"product"."created_at" desc`];
  }
}

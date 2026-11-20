import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { collectionCondition, collectionOrderBy, parseRules } from "./collection-rules";

const dialect = new PgDialect();
const render = (s: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(s);
const id = "2d422b67-306e-4ac7-9f62-02e57f06eb10";

describe("parseRules", () => {
  test("keeps valid rules, trims, drops junk", () => {
    expect(
      parseRules([
        { field: "sku", op: "startsWith", value: "  JBM-  " },
        { field: "sku", op: "lte", value: "x" },
        { field: "category", op: "is", value: "not-a-uuid" },
        { field: "price", op: "gte", value: "-1" },
        { field: "onSale", op: "is", value: "whatever" },
        { field: "brand", op: "equals", value: "" },
        { field: "nope", op: "is", value: "x" },
        null,
      ]),
    ).toEqual([
      { field: "sku", op: "startsWith", value: "JBM-" },
      { field: "onSale", op: "is", value: "true" },
    ]);
    expect(parseRules("oops")).toEqual([]);
  });
});

describe("collectionCondition", () => {
  test("smart without rules matches nothing", () => {
    expect(render(collectionCondition({ id, kind: "smart", match: "all", rules: [], sort: "featured" })).sql).toBe("false");
  });

  test("joins rules with and/or and escapes like patterns", () => {
    const rules = [
      { field: "sku", op: "startsWith", value: "A_1%" },
      { field: "category", op: "isNot", value: id },
    ];
    const all = render(collectionCondition({ id, kind: "smart", match: "all", rules, sort: "featured" }));
    expect(all.sql).toContain(" and not exists (");
    expect(all.sql).toContain("with recursive");
    expect(all.params).toContain("A\\_1\\%%");
    const any = render(collectionCondition({ id, kind: "smart", match: "any", rules, sort: "featured" }));
    expect(any.sql).toContain(" or not exists (");
  });

  test("manual reads collection_product", () => {
    const q = render(collectionCondition({ id, kind: "manual", match: "all", rules: [], sort: "manual" }));
    expect(q.sql).toContain("collection_product");
    expect(q.params).toEqual([id]);
  });
});

describe("collectionOrderBy", () => {
  test("manual position only applies to manual collections", () => {
    expect(render(collectionOrderBy({ id, kind: "manual", sort: "manual" })[0]!).sql).toContain("cp.position");
    expect(render(collectionOrderBy({ id, kind: "smart", sort: "manual" })[0]!).sql).toContain("name");
  });
});

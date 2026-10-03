import "server-only";

import { db } from "@qubo/db/client";
import { category, productCategory } from "@qubo/db/schema";
import { asc, count, eq } from "drizzle-orm";

/** A category in depth-first display order, with product counts. */
export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  depth: number;
  /** Products linked directly to this category. */
  direct: number;
  /** Products in this category and everything below it (a product counts once per category). */
  total: number;
  childCount: number;
};

export async function getCategoryTree(siteId: string): Promise<CategoryNode[]> {
  const [rows, counts] = await Promise.all([
    db
      .select({ id: category.id, name: category.name, slug: category.slug, parentId: category.parentId, position: category.position })
      .from(category)
      .where(eq(category.siteId, siteId))
      .orderBy(asc(category.position), asc(category.name)),
    db
      .select({ id: productCategory.categoryId, value: count() })
      .from(productCategory)
      .innerJoin(category, eq(category.id, productCategory.categoryId))
      .where(eq(category.siteId, siteId))
      .groupBy(productCategory.categoryId),
  ]);
  const direct = new Map(counts.map((c) => [c.id, c.value]));
  const ids = new Set(rows.map((r) => r.id));
  const children = new Map<string | null, typeof rows>();
  for (const r of rows) {
    // An orphaned parent reference is shown at the top level rather than hidden.
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    children.set(key, [...(children.get(key) ?? []), r]);
  }
  const out: CategoryNode[] = [];
  const walk = (parentId: string | null, depth: number): number => {
    let sum = 0;
    for (const r of children.get(parentId) ?? []) {
      const node: CategoryNode = {
        id: r.id,
        name: r.name,
        slug: r.slug,
        parentId: r.parentId,
        depth,
        direct: direct.get(r.id) ?? 0,
        total: 0,
        childCount: children.get(r.id)?.length ?? 0,
      };
      out.push(node);
      node.total = node.direct + walk(r.id, depth + 1);
      sum += node.total;
    }
    return sum;
  };
  walk(null, 0);
  return out;
}

/** Ids of `id` and every category below it. */
export function subtreeIds(tree: CategoryNode[], id: string): Set<string> {
  const out = new Set([id]);
  const start = tree.findIndex((n) => n.id === id);
  if (start < 0) return out;
  for (let i = start + 1; i < tree.length && tree[i]!.depth > tree[start]!.depth; i++) out.add(tree[i]!.id);
  return out;
}

/** "Parent › Child" labels, keyed by id. */
export function categoryPaths(tree: CategoryNode[]): Map<string, string> {
  const byId = new Map(tree.map((n) => [n.id, n]));
  const out = new Map<string, string>();
  for (const n of tree) {
    const parent = n.parentId ? out.get(n.parentId) : undefined;
    out.set(n.id, parent && byId.has(n.parentId!) ? `${parent} › ${n.name}` : n.name);
  }
  return out;
}

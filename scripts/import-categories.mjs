// Rebuilds the HM Froid category tree and product links from the ShopApplication archive.
//
// Sources (all inside the private archive):
//   admin/admin_articles_rubriques.php.html  the admin "quick navigation" <select>: every category
//                                            in display order, with its legacy id; depth = &nbsp; / 3.
//   public/pages/* (via manifest.json)       product pages at "-xml-<cat_path>-<id>.html"; the URL gives
//                                            the category path, the page gives the product reference.
//   exports/products.txt                     category name paths per reference; fills products that
//                                            had no public page.
//
// Dry run by default. `--apply` writes. Safe to re-run: existing categories keep any edits made in the
// admin; only missing categories and links are added.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const root = process.cwd();
const archiveRoot =
  process.env.HMF_ARCHIVE_DIR ?? join(root, ".private", "legacy-archive", "2026-09-18");
const siteSlug = process.env.HMF_SITE_SLUG ?? "hm-froid";
const apply = process.argv.includes("--apply");
const LEGACY_SYSTEM = "shopapplication";

const clean = (s) => s.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const norm = (s) => clean(s).toLowerCase();
const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

async function readTree() {
  const html = await readFile(join(archiveRoot, "admin", "admin_articles_rubriques.php.html"), "utf8");
  const start = html.indexOf("NAVIGATION RAPIDE");
  if (start < 0) throw new Error("Category <select> not found in the admin archive.");
  const select = html.slice(start, html.indexOf("</select>", start));
  const tree = [];
  const stack = [];
  for (const [, id, label] of select.matchAll(/<option value="(\d+)"[^>]*>(.*?)<\/option>/g)) {
    const depth = Math.floor((label.match(/&nbsp;/g)?.length ?? 0) / 3);
    stack.length = depth;
    tree.push({ id, name: clean(label), depth, parent: stack.at(-1) ?? null, position: 0 });
    stack.push(id);
  }
  const siblings = new Map();
  for (const node of tree) {
    const n = siblings.get(node.parent) ?? 0;
    node.position = n;
    siblings.set(node.parent, n + 1);
  }
  return tree;
}

function assignSlugs(tree) {
  const byId = new Map(tree.map((n) => [n.id, n]));
  const used = new Set();
  for (const node of tree) {
    const base = slugify(node.name) || "categorie";
    const parent = node.parent ? byId.get(node.parent) : null;
    const candidates = [base, parent ? `${parent.slug}-${base}`.slice(0, 80) : null, `${base}-${node.id}`];
    node.slug = candidates.find((c) => c && !used.has(c));
    used.add(node.slug);
  }
}

async function readPageLinks(knownIds) {
  const manifest = JSON.parse(await readFile(join(archiveRoot, "manifest.json"), "utf8"));
  const links = new Map();
  let mismatched = 0;
  for (const entry of manifest) {
    const match = entry.url?.match(/-xml-([\d_]+)-\d+\.html$/);
    if (!match) continue;
    const page = await readFile(join(archiveRoot, entry.path), "utf8");
    const ref = page.match(/id="a_fa_ref">\s*Référence\s*-\s*(.*?)<\/div>/)?.[1];
    if (!ref) continue;
    const leaf = match[1].split("_").at(-1);
    if (!knownIds.has(leaf)) {
      mismatched += 1;
      continue;
    }
    const key = clean(ref);
    if (!links.has(key)) links.set(key, new Set());
    links.get(key).add(leaf);
  }
  return { links, mismatched };
}

async function readExportLinks(tree) {
  const byId = new Map(tree.map((n) => [n.id, n]));
  const pathOf = (node) => {
    const parts = [];
    for (let n = node; n; n = n.parent ? byId.get(n.parent) : null) parts.unshift(norm(n.name));
    return parts.join(" > ");
  };
  const byPath = new Map();
  for (const node of tree) {
    const key = pathOf(node);
    byPath.set(key, byPath.has(key) ? null : node.id); // null marks an ambiguous path
  }
  const text = await readFile(join(archiveRoot, "exports", "products.txt"), "utf8");
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));
  const col = (name) => header.findIndex((h) => h.trim() === name);
  const refCol = col("Référence");
  const levels = [1, 2, 3, 4, 5].map((n) => col(`Nom de la catégorie ${n} (fr)`));
  const links = new Map();
  let skipped = 0;
  for (const cells of lines) {
    const path = levels.map((i) => (i >= 0 ? norm(cells[i] ?? "") : "")).filter(Boolean).join(" > ");
    const id = byPath.get(path);
    if (!id) {
      skipped += 1;
      continue;
    }
    const ref = clean(cells[refCol] ?? "");
    if (!links.has(ref)) links.set(ref, new Set());
    links.get(ref).add(id);
  }
  return { links, skipped };
}

const tree = await readTree();
assignSlugs(tree);
const knownIds = new Set(tree.map((n) => n.id));
const pages = await readPageLinks(knownIds);
const exported = await readExportLinks(tree);

// Public pages are authoritative; the export only fills references without a page.
const links = new Map(pages.links);
for (const [ref, ids] of exported.links) if (!links.has(ref)) links.set(ref, ids);

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const [site] = await sql`select id from site where slug = ${siteSlug}`;
  if (!site) throw new Error(`Site "${siteSlug}" not found.`);
  const products = await sql`
    select id, legacy_id from product where site_id = ${site.id} and legacy_system = ${LEGACY_SYSTEM}`;
  const productByRef = new Map(products.map((p) => [p.legacy_id.trim(), p.id]));
  const pairs = [];
  for (const [ref, ids] of links) {
    const productId = productByRef.get(ref);
    if (productId) for (const id of ids) pairs.push({ productId, legacyCategoryId: id });
  }
  const linkedProducts = new Set(pairs.map((p) => p.productId)).size;

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        site: siteSlug,
        categories: tree.length,
        roots: tree.filter((n) => !n.parent).length,
        maxDepth: Math.max(...tree.map((n) => n.depth)),
        pageLinkedRefs: pages.links.size,
        exportOnlyRefs: links.size - pages.links.size,
        exportRowsUnresolved: exported.skipped,
        pageUrlsOutsideTree: pages.mismatched,
        productLinks: pairs.length,
        productsLinked: linkedProducts,
        productsWithoutCategory: products.length - linkedProducts,
      },
      null,
      2,
    ),
  );
  if (!apply) {
    console.log("Dry run. Re-run with --apply to write.");
    process.exit(0);
  }

  await sql.begin(async (tx) => {
    const existing = await tx`
      select id, legacy_id, slug from category where site_id = ${site.id} and legacy_system = ${LEGACY_SYSTEM}`;
    const idByLegacy = new Map(existing.map((r) => [r.legacy_id, r.id]));
    const takenSlugs = new Set((await tx`select slug from category where site_id = ${site.id}`).map((r) => r.slug));
    const created = [];
    for (const node of tree) {
      if (idByLegacy.has(node.id)) continue;
      let slug = node.slug;
      if (takenSlugs.has(slug)) slug = `${slug}-${node.id}`;
      takenSlugs.add(slug);
      const legacyPath = (() => {
        const ids = [];
        const byId = new Map(tree.map((n) => [n.id, n]));
        for (let n = node; n; n = n.parent ? byId.get(n.parent) : null) ids.unshift(n.id);
        return ids.join("/");
      })();
      const [row] = await tx`
        insert into category (site_id, name, slug, position, legacy_system, legacy_id, legacy_path)
        values (${site.id}, ${node.name}, ${slug}, ${node.position}, ${LEGACY_SYSTEM}, ${node.id}, ${legacyPath})
        returning id`;
      idByLegacy.set(node.id, row.id);
      created.push(node);
    }
    for (const node of created) {
      if (!node.parent) continue;
      await tx`update category set parent_id = ${idByLegacy.get(node.parent)} where id = ${idByLegacy.get(node.id)}`;
    }
    let inserted = 0;
    for (const { productId, legacyCategoryId } of pairs) {
      const result = await tx`
        insert into product_category (product_id, category_id)
        values (${productId}, ${idByLegacy.get(legacyCategoryId)})
        on conflict do nothing`;
      inserted += result.count;
    }
    console.log(`Created ${created.length} categories, ${inserted} product links.`);
  });
} finally {
  await sql.end();
}

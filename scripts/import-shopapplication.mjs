#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import postgres from "postgres";

const root = process.cwd();
const source =
  process.env.HMF_PRODUCT_EXPORT ??
  join(root, "docs", "reference-material", "hmfroid-full-productlist.txt");
const archiveRoot =
  process.env.HMF_ARCHIVE_DIR ??
  join(root, ".private", "legacy-archive", "2026-09-18");
const outputRoot =
  process.env.HMF_IMPORT_OUTPUT ??
  join(root, ".private", "migration-output", new Date().toISOString().slice(0, 10));
const apply = process.argv.includes("--apply");
const LEGACY_SYSTEM = "shopapplication";

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function mapRows(rows) {
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row, sourceIndex) => ({
    sourceIndex: sourceIndex + 2,
    values: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  }));
}

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function money(value) {
  const normalized = clean(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number < 100_000_000
    ? number.toFixed(2)
    : null;
}

function integer(value) {
  const number = Number.parseInt(clean(value), 10);
  return Number.isFinite(number) ? number : 0;
}

function date(value) {
  const normalized = clean(value);
  if (!normalized) return null;
  const parsed = new Date(normalized.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stableUuid(namespace, value) {
  const bytes = createHash("sha256").update(`${namespace}:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeProducts(mappedRows) {
  const seen = new Map();
  const duplicates = [];
  const invalid = [];
  const products = [];

  for (const { sourceIndex, values } of mappedRows) {
    const reference = clean(values["Référence"]);
    const name = clean(values["Nom de l'article (en Français)"]);
    const defaultPrice = money(values['Prix pour le groupe "Défaut"']);
    const resellerPrice = money(values['Prix pour le groupe "Revendeurs"']);
    if (!reference || !name || defaultPrice === null) {
      invalid.push({ sourceIndex, reference, name, reason: "missing reference/name/price" });
      continue;
    }
    if (seen.has(reference)) {
      duplicates.push({
        reference,
        keptSourceIndex: seen.get(reference),
        skippedSourceIndex: sourceIndex,
      });
      continue;
    }
    seen.set(reference, sourceIndex);
    const suffix = createHash("sha1").update(reference).digest("hex").slice(0, 7);
    const slug = `${slugify(name) || "produit"}-${suffix}`;
    products.push({
      id: stableUuid("product", reference),
      variantId: stableUuid("variant", reference),
      legacyId: reference,
      reference,
      name,
      slug,
      taxRate: clean(values["Taux de TVA"]),
      defaultPrice,
      resellerPrice:
        resellerPrice && Number(resellerPrice) > 0 ? resellerPrice : null,
      image: clean(values["Image principale"]) || null,
      quantity: integer(values["Stock - Quantité"]),
      barcode: clean(values["Stock - Code EAN"]) || null,
      supplier: clean(values["Stock - Fournisseur"]) || null,
      storageLocation: clean(values["Stock - Emplacement de stockage"]) || null,
      stockedAt: date(values["Stock - Date d'entrée en stock"]),
      tracked: clean(values["Ne pas gérer le stock"]).toLowerCase() !== "oui",
      attributes: clean(values["Couleur (hexa)"])
        ? { color: clean(values["Couleur (hexa)"]) }
        : {},
      sourceIndex,
      source: values,
    });
  }
  return { products, duplicates, invalid };
}

function normalizeCustomers(rows) {
  const mapped = mapRows(rows);
  const customers = [];
  const invalid = [];
  const seen = new Set();
  for (const { sourceIndex, values } of mapped) {
    const legacyId = clean(values["Identifiant"]);
    const email = clean(values["Adresse e-mail"]).toLowerCase();
    if (!legacyId || !email || !email.includes("@")) {
      invalid.push({ sourceIndex, legacyId, email });
      continue;
    }
    const key = `${legacyId}:${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    customers.push({
      id: stableUuid("customer", legacyId),
      legacyId,
      email,
      firstName: clean(values["Prénom"]) || null,
      lastName: clean(values["Nom"]) || null,
      phone: clean(values["Téléphone"]) || null,
      company: clean(values["Société"]) || null,
      vatNumber: clean(values["TVA intracommunautaire"]) || null,
      group: clean(values["Groupe"]) || "Défaut",
      acceptsMarketing:
        clean(values["Abonnement à la newsletter"]).toLowerCase() === "oui",
      // Deliberately excludes the legacy password hash.
      source: Object.fromEntries(
        Object.entries(values).filter(([key]) => key !== "Mot de passe"),
      ),
    });
  }
  return { customers, invalid };
}

async function loadCustomers() {
  const path = join(archiveRoot, "exports", "customers-all.csv");
  const text = await readFile(path, "utf8");
  // ShopApplication's customer TSV contains unescaped quote characters in
  // free-text fields. Records themselves are one physical line, so a strict
  // quote-aware CSV parser would incorrectly merge unrelated customers.
  const rows = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));
  return normalizeCustomers(rows);
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonLines(path, rows) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

async function importDatabase(products, customers) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required with --apply.");
  const ownerId = process.env.HMF_OWNER_ID;
  const ownerEmail = process.env.HMF_OWNER_EMAIL;
  if (!ownerId || !ownerEmail) {
    throw new Error("HMF_OWNER_ID and HMF_OWNER_EMAIL are required with --apply.");
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const organizationId = stableUuid("organization", "wooster");
  // Namespace stays "store": changing it would mint new ids on re-import.
  const siteId = stableUuid("store", "hm-froid");
  const defaultGroupId = stableUuid("customer-group", "hm-froid:default");
  const resellerGroupId = stableUuid("customer-group", "hm-froid:resellers");
  const defaultPriceListId = stableUuid("price-list", "hm-froid:default");
  const resellerPriceListId = stableUuid("price-list", "hm-froid:resellers");

  try {
    await sql.begin(async (tx) => {
      await tx`insert into "user" (id, name, email, email_verified, role)
        values (${ownerId}, ${process.env.HMF_OWNER_NAME ?? "Mostapha"}, ${ownerEmail}, true, 'ADMIN')
        on conflict (id) do update set name = excluded.name, email = excluded.email, role = 'ADMIN'`;
      await tx`insert into organization (id, name, slug)
        values (${organizationId}, 'Wooster', 'wooster')
        on conflict (slug) do update set name = excluded.name`;
      await tx`insert into organization_member (id, organization_id, user_id, role)
        values (${stableUuid("organization-member", `${organizationId}:${ownerId}`)}, ${organizationId}, ${ownerId}, 'OWNER')
        on conflict (organization_id, user_id) do update set role = 'OWNER'`;
      await tx`insert into site (id, organization_id, name, slug, owner_id, currency, locale)
        values (${siteId}, ${organizationId}, 'HM Froid', 'hm-froid', ${ownerId}, 'EUR', 'fr-BE')
        on conflict (slug) do update set name = excluded.name, organization_id = excluded.organization_id`;
      await tx`insert into site_settings (id, site_id, timezone)
        values (${stableUuid("store-settings", siteId)}, ${siteId}, 'Europe/Brussels')
        on conflict (site_id) do nothing`;

      for (const [id, name, slug, legacyId] of [
        [defaultGroupId, "Défaut", "default", "1"],
        [resellerGroupId, "Revendeurs", "resellers", "4"],
      ]) {
        await tx`insert into customer_group
          (id, site_id, name, slug, legacy_system, legacy_id)
          values (${id}, ${siteId}, ${name}, ${slug}, ${LEGACY_SYSTEM}, ${legacyId})
          on conflict (site_id, slug) do update set name = excluded.name`;
      }
      for (const [id, groupId, name, slug] of [
        [defaultPriceListId, defaultGroupId, "Prix public", "default"],
        [resellerPriceListId, resellerGroupId, "Prix revendeurs", "resellers"],
      ]) {
        await tx`insert into price_list
          (id, site_id, customer_group_id, name, slug, currency, includes_tax)
          values (${id}, ${siteId}, ${groupId}, ${name}, ${slug}, 'EUR', true)
          on conflict (site_id, slug) do update set name = excluded.name`;
      }

      for (const item of products) {
        await tx`insert into product
          (id, site_id, name, slug, base_price, attributes, legacy_system, legacy_id, source_snapshot, is_archived)
          values (${item.id}, ${siteId}, ${item.name}, ${item.slug}, ${item.defaultPrice},
            ${tx.json(item.attributes)}, ${LEGACY_SYSTEM}, ${item.legacyId}, ${tx.json(item.source)}, false)
          on conflict (site_id, legacy_system, legacy_id) do update set
            name = excluded.name, slug = excluded.slug, base_price = excluded.base_price,
            attributes = excluded.attributes, source_snapshot = excluded.source_snapshot`;
        await tx`insert into product_variant
          (id, site_id, product_id, sku, name, price, barcode, legacy_system, legacy_id, source_snapshot)
          values (${item.variantId}, ${siteId}, ${item.id}, ${item.reference}, ${item.name},
            ${item.defaultPrice}, ${item.barcode}, ${LEGACY_SYSTEM}, ${item.legacyId}, ${tx.json(item.source)})
          on conflict (site_id, legacy_system, legacy_id) do update set
            sku = excluded.sku, name = excluded.name, price = excluded.price,
            barcode = excluded.barcode, source_snapshot = excluded.source_snapshot`;
        await tx`insert into inventory_item
          (id, variant_id, quantity, tracked, supplier, storage_location, legacy_system, legacy_id, legacy_stocked_at)
          values (${stableUuid("inventory", item.reference)}, ${item.variantId}, ${item.quantity},
            ${item.tracked}, ${item.supplier}, ${item.storageLocation}, ${LEGACY_SYSTEM}, ${item.legacyId},
            ${item.stockedAt || null})
          on conflict (variant_id) do update set
            quantity = excluded.quantity, tracked = excluded.tracked,
            supplier = excluded.supplier, storage_location = excluded.storage_location`;
        await tx`insert into price_list_price
          (id, price_list_id, variant_id, amount)
          values (${stableUuid("price", `default:${item.reference}`)}, ${defaultPriceListId}, ${item.variantId}, ${item.defaultPrice})
          on conflict (price_list_id, variant_id) do update set amount = excluded.amount`;
        if (item.resellerPrice) {
          await tx`insert into price_list_price
            (id, price_list_id, variant_id, amount)
            values (${stableUuid("price", `reseller:${item.reference}`)}, ${resellerPriceListId}, ${item.variantId}, ${item.resellerPrice})
            on conflict (price_list_id, variant_id) do update set amount = excluded.amount`;
        }
        if (item.image) {
          await tx`insert into product_image (id, product_id, url, alt, position)
            values (${stableUuid("image", item.reference)}, ${item.id}, ${`/api/legacy-assets/${encodeURIComponent(item.image)}`}, ${item.name}, 0)
            on conflict (id) do update set url = excluded.url, alt = excluded.alt`;
        }
      }

      for (const customer of customers) {
        await tx`insert into site_customer
          (id, site_id, email, first_name, last_name, phone, company, vat_number,
            accepts_marketing, legacy_system, legacy_id, source_snapshot)
          values (${customer.id}, ${siteId}, ${customer.email}, ${customer.firstName}, ${customer.lastName},
            ${customer.phone}, ${customer.company}, ${customer.vatNumber}, ${customer.acceptsMarketing},
            ${LEGACY_SYSTEM}, ${customer.legacyId}, ${tx.json(customer.source)})
          on conflict (site_id, legacy_system, legacy_id) do update set
            email = excluded.email, first_name = excluded.first_name, last_name = excluded.last_name,
            phone = excluded.phone, company = excluded.company, vat_number = excluded.vat_number,
            accepts_marketing = excluded.accepts_marketing, source_snapshot = excluded.source_snapshot`;
      }
    });
  } finally {
    await sql.end();
  }
  return { organizationId, siteId };
}

const productText = await readFile(source, "utf8");
const productResult = normalizeProducts(
  mapRows(parseDelimited(productText, ";")),
);
const customerResult = await loadCustomers();
const assetManifest = JSON.parse(
  await readFile(join(archiveRoot, "manifest.json"), "utf8"),
);
const availableImages = new Set(
  assetManifest
    .filter((item) => item.path?.startsWith("assets/products/") && item.status === 200)
    .map((item) => item.path.split("/").at(-1)?.toLowerCase()),
);
const missingImages = productResult.products
  .filter((product) => product.image && !availableImages.has(product.image.toLowerCase()))
  .map((product) => ({ reference: product.reference, image: product.image }));

await writeJsonLines(join(outputRoot, "products.normalized.jsonl"), productResult.products);
await writeJsonLines(
  join(outputRoot, "customers.normalized.jsonl"),
  customerResult.customers,
);
const report = {
  generatedAt: new Date().toISOString(),
  mode: apply ? "apply" : "dry-run",
  source,
  expected: { products: 4165, customers: 2263 },
  products: {
    sourceRows: productResult.products.length + productResult.duplicates.length + productResult.invalid.length,
    normalized: productResult.products.length,
    duplicates: productResult.duplicates.length,
    invalid: productResult.invalid.length,
    missingImages: missingImages.length,
  },
  customers: {
    normalized: customerResult.customers.length,
    invalid: customerResult.invalid.length,
  },
  duplicateProducts: productResult.duplicates,
  invalidProducts: productResult.invalid,
  invalidCustomers: customerResult.invalid,
  missingImages,
};

let database = null;
if (apply) {
  database = await importDatabase(productResult.products, customerResult.customers);
}
await writeJson(join(outputRoot, "reconciliation.json"), { ...report, database });
console.log(
  JSON.stringify(
    {
      outputRoot,
      mode: report.mode,
      products: report.products,
      customers: report.customers,
      database,
    },
    null,
    2,
  ),
);

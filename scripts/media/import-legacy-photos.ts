/**
 * Moves a site's legacy product photos (`/api/legacy-assets/<file>`, served from
 * LEGACY_ASSET_ROOT) into the media library, then points `product_image` at them.
 * Ticket ml2-import of `.plans/media-library.md`.
 *
 *   tsx scripts/media/import-legacy-photos.ts --site hm-froid            # dry run (default)
 *   tsx scripts/media/import-legacy-photos.ts --site hm-froid --apply [--limit 50]
 *
 * Env: DATABASE_URL, LEGACY_ASSET_ROOT, and the storage env (STORAGE_DIR or STORAGE_*).
 * Locally: `set -a; . ./.env; set +a; npx tsx scripts/media/import-legacy-photos.ts ...`
 *
 * On prod (decision 44, compose on Mostapha's VPS): `qubo-admin` mounts the photos but is a
 * Next standalone image with no sources and no tsx. `qubo-elysia` has the whole workspace,
 * bun, DATABASE_URL, the storage env and the `media` volume, so the script runs in a one-off
 * elysia container with the legacy folder mounted read-only. It runs as uid 1001, the owner
 * of the `qubo_media` volume. From the repo on the VPS, once this code is pushed and the
 * elysia image rebuilt (`docker compose -f docker-compose.yml -f docker-compose.coolify.yml
 * build qubo-elysia`), and after `scripts/backup.sh`:
 *
 *   docker compose -f docker-compose.yml -f docker-compose.coolify.yml run --rm --no-deps \
 *     -u 1001:1001 -v ~/qubo-data/legacy-products:/data/legacy-products:ro \
 *     -e LEGACY_ASSET_ROOT=/data/legacy-products \
 *     qubo-elysia bun scripts/media/import-legacy-photos.ts --site hm-froid --dry-run
 *
 * then the same with `--apply`. It copies about 339 MB into the media volume; the legacy
 * folder is only read.
 *
 * Idempotent:
 * - only rows whose url is still `/api/legacy-assets/...` with no asset are touched;
 * - a file whose sha256 already exists in the organisation reuses that asset;
 * - a new asset's id is derived from (org, sha256), so if the file was stored but the DB write
 *   failed, the next run computes the same key, rewrites the same file and inserts the row;
 * - DB writes for one file (asset, tag, product_image rows) run in one transaction.
 * Missing or rejected files are reported and their rows stay as they are.
 *
 * Old links: `/api/legacy-assets/<file>` keeps serving from the folder while it is mounted.
 * When the folder or the file is gone, the admin route 301s to the library file, found by
 * filename and tag `import:shopapplication` (scoped to the org of the admin host's site, and
 * only when exactly one asset matches). The storefront has no DB access (it reads through the
 * API), so its route keeps serving from the folder only; product pages already use the new
 * `/api/media/...` URLs. A legacy file that is a byte-for-byte copy of another reuses that
 * asset under the other name, so the admin 301 cannot find it by name and answers 404.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { and, asc, eq, isNull, like, sql } from "drizzle-orm";
import { db } from "@qubo/db/client";
import { asset, assetTag, product, productImage, site } from "@qubo/db/schema";
import { checkFile, cleanFilename, formatBytes, mediaKey, mediaUrl, problemMessage } from "@qubo/storage";
import { dimensions, storage, storageConfigured } from "@qubo/storage/server";

const PREFIX = "/api/legacy-assets/";
const TAG = "import:shopapplication";

function parseArgs(argv: string[]) {
  const out = { site: "", apply: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--site") out.site = argv[++i] ?? "";
    else if (a === "--apply") out.apply = true;
    else if (a === "--dry-run") out.apply = false;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!out.site) throw new Error("--site <slug> is required");
  if (!(out.limit > 0)) throw new Error("--limit must be a positive number");
  return out;
}

/** Stable asset id for (org, file hash): a re-run after a half-done write lands on the same key. */
function importAssetId(orgId: string, sha256: string) {
  const h = createHash("sha256").update(`qubo-legacy-import:${orgId}:${sha256}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const extOfKey = (key: string) => key.slice(key.lastIndexOf(".") + 1);

function legacyFilename(url: string) {
  try {
    const name = decodeURIComponent(url.slice(PREFIX.length));
    return name && name === basename(name) && !name.includes("\0") ? name : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.env.LEGACY_ASSET_ROOT?.trim();
  if (!root) throw new Error("LEGACY_ASSET_ROOT is not set");
  if (args.apply && !storageConfigured()) throw new Error("Storage is not configured (STORAGE_DIR, or STORAGE_ENDPOINT and bucket)");

  const [s] = await db.select({ id: site.id, orgId: site.organizationId, name: site.name }).from(site).where(eq(site.slug, args.site)).limit(1);
  if (!s) throw new Error(`No site with slug ${args.site}`);
  const siteProducts = sql`${productImage.productId} in (select ${product.id} from ${product} where ${product.siteId} = ${s.id})`;

  const rows = await db
    .select({ url: productImage.url, alt: productImage.alt, legacyId: product.legacyId })
    .from(productImage)
    .innerJoin(product, eq(product.id, productImage.productId))
    .where(and(eq(product.siteId, s.id), like(productImage.url, `${PREFIX}%`), isNull(productImage.assetId)));

  const byUrl = new Map<string, { rows: number; alt: string; refs: string[] }>();
  for (const r of rows) {
    const e = byUrl.get(r.url) ?? { rows: 0, alt: "", refs: [] };
    e.rows++;
    if (!e.alt && r.alt?.trim()) e.alt = r.alt.trim();
    if (r.legacyId && e.refs.length < 3) e.refs.push(r.legacyId);
    byUrl.set(r.url, e);
  }
  const urls = [...byUrl.keys()].sort().slice(0, args.limit);

  console.log(`${args.apply ? "APPLY" : "DRY RUN"}: site ${args.site} (${s.name}), org ${s.orgId}`);
  console.log(`${rows.length} legacy rows, ${byUrl.size} distinct files, processing ${urls.length}\n`);

  const sum = { imported: 0, reused: 0, missing: 0, rejected: 0, failed: 0, rows: 0, bytes: 0 };
  const problems: string[] = [];
  // Dry runs write nothing, so files repeated within this run are tracked here.
  const seen = new Map<string, { id: string; key: string }>();

  for (const url of urls) {
    const entry = byUrl.get(url)!;
    const who = entry.refs.length ? ` (product ${entry.refs.join(", ")})` : "";
    const filename = legacyFilename(url);
    if (!filename) {
      sum.rejected++;
      problems.push(`rejected  ${url}${who}: not a plain filename`);
      continue;
    }
    const bytes = await readFile(join(root, filename)).then((b) => new Uint8Array(b)).catch(() => null);
    if (!bytes) {
      sum.missing++;
      problems.push(`missing   ${filename}${who}`);
      continue;
    }
    const clean = cleanFilename(filename);
    const checked = checkFile("media", clean, bytes);
    if (!checked.ok) {
      sum.rejected++;
      problems.push(`rejected  ${problemMessage(checked.problem, filename, "media")}${who}`);
      continue;
    }
    const hash = createHash("sha256").update(bytes).digest("hex");
    const ownId = importAssetId(s.orgId, hash);
    const [found] = await db
      .select({ id: asset.id, key: asset.key })
      .from(asset)
      .where(and(eq(asset.organizationId, s.orgId), eq(asset.sha256, hash)))
      .orderBy(sql`${asset.id} = ${ownId} desc`, asset.createdAt, asc(asset.id))
      .limit(1);
    const existing = found ?? seen.get(hash);

    if (args.apply) {
      try {
        const id = existing?.id ?? ownId;
        const key = existing?.key ?? mediaKey(s.orgId, id, checked.file.ext);
        const ext = extOfKey(key);
        if (!existing) await storage().put(key, bytes, checked.file.mime);
        const dims = checked.file.kind === "image" ? dimensions(bytes) : null;
        const written = await db.transaction(async (tx) => {
          if (!existing) {
            await tx
              .insert(asset)
              .values({
                id,
                organizationId: s.orgId,
                siteId: s.id,
                key,
                filename: clean,
                mimeType: checked.file.mime,
                size: bytes.byteLength,
                width: dims?.width ?? null,
                height: dims?.height ?? null,
                alt: entry.alt.slice(0, 300),
                sha256: hash,
                createdById: null,
              })
              .onConflictDoNothing();
          }
          // A merchant upload that happens to match keeps its own tags.
          if (id === ownId) {
            await tx.insert(assetTag).values({ assetId: id, tag: TAG }).onConflictDoNothing();
            if (entry.alt) await tx.update(asset).set({ alt: entry.alt.slice(0, 300) }).where(and(eq(asset.id, id), eq(asset.alt, "")));
          }
          const updated = await tx
            .update(productImage)
            .set({ url: mediaUrl(s.orgId, id, ext), assetId: id })
            .where(and(eq(productImage.url, url), isNull(productImage.assetId), siteProducts))
            .returning({ id: productImage.id });
          return updated.length;
        });
        if (written !== entry.rows) problems.push(`note      ${filename}: ${written} rows rewritten, expected ${entry.rows}`);
        entry.rows = written;
      } catch (e) {
        sum.failed++;
        problems.push(`failed    ${filename}${who}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
    }

    if (existing) sum.reused++;
    else {
      sum.imported++;
      sum.bytes += bytes.byteLength;
      seen.set(hash, { id: ownId, key: mediaKey(s.orgId, ownId, checked.file.ext) });
    }
    sum.rows += entry.rows;
  }

  for (const p of problems) console.log(p);
  console.log(
    `\nSummary${args.apply ? "" : " (planned)"}: ${sum.imported} imported (${formatBytes(sum.bytes)}), ${sum.reused} reused, ` +
      `${sum.missing} missing, ${sum.rejected} rejected, ${sum.failed} failed, ${sum.rows} product_image rows rewritten`,
  );
  if (!args.apply) console.log("Dry run: nothing was written. Re-run with --apply.");
  return sum.failed ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });

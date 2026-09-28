#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const ORIGIN = "https://www.hmfroid.be";
const outputRoot =
  process.env.HMF_ARCHIVE_DIR ??
  join(process.cwd(), ".private", "legacy-archive", new Date().toISOString().slice(0, 10));
const username = process.env.HMF_LEGACY_USER;
const password = process.env.HMF_LEGACY_PASS;

if (!username || !password) {
  throw new Error("Set HMF_LEGACY_USER and HMF_LEGACY_PASS.");
}

const manifest = [];
let cookie = "";

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

function safeName(value) {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[?#].*$/, "")
    .replace(/[^a-zA-Z0-9._/-]+/g, "_")
    .replace(/\.\./g, "_");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function updateCookie(headers) {
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  const incoming = values.map((value) => value.split(";", 1)[0]);
  if (!incoming.length) return;
  const jar = new Map(
    cookie
      .split("; ")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), part.slice(index + 1)];
      }),
  );
  for (const part of incoming) {
    const index = part.indexOf("=");
    jar.set(part.slice(0, index), part.slice(index + 1));
  }
  cookie = [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    ...options,
    headers: {
      "user-agent": "HM-Froid-owned-data-migration/1.0",
      "accept-language": "fr-BE,fr;q=0.9",
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });
  updateCookie(response.headers);

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect without location: ${url}`);
    return request(new URL(location, url).href, {
      ...options,
      method: "GET",
      body: undefined,
    });
  }
  return response;
}

async function saveResponse(url, relativePath, options = {}) {
  const destination = join(outputRoot, relativePath);
  try {
    const buffer = await readFile(destination);
    manifest.push({
      url,
      path: relativePath,
      status: 200,
      contentType: null,
      bytes: buffer.length,
      sha256: sha256(buffer),
      capturedAt: new Date().toISOString(),
      resumed: true,
    });
    return { buffer, response: null };
  } catch {
    // The snapshot is resumable: fetch only files not already present.
  }
  const response = await request(url, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureDir(join(destination, ".."));
  await writeFile(destination, buffer);
  manifest.push({
    url,
    path: relativePath,
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: buffer.length,
    sha256: sha256(buffer),
    capturedAt: new Date().toISOString(),
  });
  if (!response.ok) {
    throw new Error(`${response.status} while archiving ${url}`);
  }
  return { buffer, response };
}

async function mapConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
}

async function login() {
  const body = new URLSearchParams({
    login: username,
    pass: password,
    refered: "",
  });
  const response = await request(
    `${ORIGIN}/superadmin/admin_login_admin.php?action=login_me`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const html = await response.text();
  if (!/Déconnexion|Gestion des articles/i.test(html)) {
    throw new Error("Legacy administrator authentication failed.");
  }
}

function parseDelimited(text, delimiter = text.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ";") {
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
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function extractUrls(xml) {
  return [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/gis)].map(
    (match) => match[1].trim().replaceAll("&amp;", "&"),
  );
}

async function archiveAdmin() {
  const pages = [
    "admin_articles_rubriques.php?page=1&language=fr",
    "admin_import_donnees.php?language=fr",
    "clients-export.html?language=fr",
    "clients-liste.html?language=fr",
    "articles-stock.html?language=fr",
    "articles-tarifs.html?language=fr",
    "commandes-liste.html?language=fr",
    "commandes-export_ca.html?language=fr",
    "commandes-export_ventes.html?language=fr",
    "parametres-generaux.html?language=fr",
    "sp_admin_diaporama_fond.php?language=fr",
  ];
  let menuHtml = "";
  for (const page of pages) {
    try {
      const snapshot = await saveResponse(
        `${ORIGIN}/superadmin/${page}`,
        `admin/${safeName(page)}.html`,
      );
      if (page.startsWith("admin_articles_rubriques.php")) {
        menuHtml = snapshot.buffer.toString("utf8");
      }
    } catch (error) {
      console.warn(`Admin snapshot skipped: ${page}: ${error.message}`);
    }
  }

  const safePrefixes =
    /^(articles|marketing|diffusion|clients|commandes|informations|parametres|aide|divers)-[a-zA-Z0-9_-]+\.html$/;
  const unsafeActions = /(delete|remove|logout|send|print|upload|process|download|cache)/i;
  const menuPages = [
    ...new Set(
      [...menuHtml.matchAll(/href=["']([^"'?#]+\.html)["']/gi)]
        .map((match) => match[1].replace(/^\/superadmin\//, ""))
        .filter((href) => safePrefixes.test(href) && !unsafeActions.test(href)),
    ),
  ];
  await mapConcurrent(menuPages, 6, async (page) => {
    try {
      await saveResponse(
        `${ORIGIN}/superadmin/${page}?language=fr`,
        `admin/modules/${safeName(page)}.html`,
      );
    } catch (error) {
      console.warn(`Admin module skipped: ${page}: ${error.message}`);
    }
  });
}

async function archiveExports() {
  const productCsv = await saveResponse(
    `${ORIGIN}/cache/export_donnees.csv`,
    "exports/products.csv",
  );
  const productTxt = await saveResponse(
    `${ORIGIN}/cache/export_donnees.txt`,
    "exports/products.txt",
  );

  for (const [name, restriction] of [
    ["customers-all", "*"],
    ["customers-default", "1"],
    ["customers-resellers", "4"],
  ]) {
    try {
      const exportFile = `hmf-migration-${name}-${Date.now()}`;
      let hasData = true;
      for (let numFile = 0; numFile < 200; numFile += 1) {
        const query = new URLSearchParams({
          start: String(numFile === 0),
          numFile: String(numFile),
          exportFile,
          restriction,
        });
        const progress = await request(
          `${ORIGIN}/superadmin/clients-export-exportprocess.html?${query}`,
          { headers: { "x-requested-with": "XMLHttpRequest" } },
        );
        const result = await progress.json();
        if (result.msg === "nodata") {
          hasData = false;
          break;
        }
        if (result.msg === "error") {
          throw new Error(`Customer export failed at chunk ${numFile}`);
        }
        if (result.msg === "done") break;
      }
      if (hasData) {
        await saveResponse(
          `${ORIGIN}/superadmin/clients-export-downloadfile.html`,
          `exports/${name}.csv`,
        );
      }
    } catch (error) {
      console.warn(`Customer export skipped: ${name}: ${error.message}`);
    }
  }

  const detailedRows = parseDelimited(productCsv.buffer.toString("utf8"));
  const completeRows = parseDelimited(productTxt.buffer.toString("utf8"));
  return completeRows.length > detailedRows.length ? completeRows : detailedRows;
}

async function archiveSitemaps() {
  const root = await saveResponse(`${ORIGIN}/sitemap.xml`, "public/sitemap.xml");
  const childUrls = extractUrls(root.buffer.toString("utf8"));
  const pageUrls = new Set();
  for (const [index, url] of childUrls.entries()) {
    try {
      const child = await saveResponse(url, `public/sitemaps/${index}.xml`);
      for (const pageUrl of extractUrls(child.buffer.toString("utf8"))) {
        pageUrls.add(pageUrl);
      }
    } catch (error) {
      console.warn(`Sitemap skipped: ${url}: ${error.message}`);
    }
  }
  await writeFile(
    join(outputRoot, "public", "urls.json"),
    `${JSON.stringify([...pageUrls].sort(), null, 2)}\n`,
  );
  return pageUrls;
}

async function archivePublicPages(urls) {
  const entries = [...urls];
  let completed = 0;
  await mapConcurrent(entries, 12, async (url, index) => {
    try {
      await saveResponse(url, `public/pages/${String(index).padStart(5, "0")}.html`);
    } catch (error) {
      console.warn(`Page skipped: ${url}: ${error.message}`);
    }
    completed += 1;
    if (completed % 250 === 0) {
      console.log(`Archived ${completed}/${entries.length} public pages`);
    }
  });
}

async function archiveProductImages(rows) {
  const header = rows[0] ?? [];
  const imageIndexes = header
    .map((value, index) => (/^Image(?: principale| \d+)?$/i.test(value.trim()) ? index : -1))
    .filter((index) => index >= 0);
  if (!imageIndexes.length) throw new Error("Product image columns not found.");
  const filenames = [
    ...new Set(
      rows
        .slice(1)
        .flatMap((row) => imageIndexes.map((index) => row[index]))
        .filter(Boolean),
    ),
  ];

  let completed = 0;
  await mapConcurrent(filenames, 12, async (filename) => {
    const existingPath = join(
      outputRoot,
      `assets/products/${safeName(basename(filename))}`,
    );
    try {
      const buffer = await readFile(existingPath);
      manifest.push({
        url: null,
        path: `assets/products/${safeName(basename(filename))}`,
        status: 200,
        contentType: null,
        bytes: buffer.length,
        sha256: sha256(buffer),
        capturedAt: new Date().toISOString(),
        resumed: true,
      });
      completed += 1;
      return;
    } catch {
      // Download below.
    }
    const extension = extname(filename).slice(1).toLowerCase() || "jpg";
    const encoded = filename.split("/").map(encodeURIComponent).join("/");
    const candidates = [
      `${ORIGIN}/images/Image/${encoded}`,
      `${ORIGIN}/images/imagecache/0x0/${extension}/${encoded}`,
      `${ORIGIN}/images/imagecache/1000x1000/${extension}/${encoded}`,
    ];
    let saved = false;
    for (const url of candidates) {
      try {
        const response = await request(url);
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.startsWith("image/")) continue;
        const buffer = Buffer.from(await response.arrayBuffer());
        const relativePath = `assets/products/${safeName(basename(filename))}`;
        const destination = join(outputRoot, relativePath);
        await ensureDir(join(destination, ".."));
        await writeFile(destination, buffer);
        manifest.push({
          url,
          path: relativePath,
          status: response.status,
          contentType,
          bytes: buffer.length,
          sha256: sha256(buffer),
          capturedAt: new Date().toISOString(),
        });
        saved = true;
        break;
      } catch {
        // Try the next known ShopApplication image path.
      }
    }
    if (!saved) {
      manifest.push({
        url: candidates[0],
        path: null,
        status: 404,
        contentType: null,
        bytes: 0,
        sha256: null,
        capturedAt: new Date().toISOString(),
        error: `Could not locate ${filename}`,
      });
    }
    completed += 1;
    if (completed % 100 === 0) {
      console.log(`Archived ${completed}/${filenames.length} product images`);
    }
  });
}

async function finish(rows, urls) {
  const report = {
    capturedAt: new Date().toISOString(),
    source: ORIGIN,
    productRows: Math.max(0, rows.length - 1),
    publicUrls: urls.size,
    files: manifest.filter((item) => item.status >= 200 && item.status < 300).length,
    failedFiles: manifest.filter((item) => item.status < 200 || item.status >= 300)
      .length,
    expectedAdminCounts: {
      activeProducts: 3174,
      inactiveProducts: 991,
      totalProducts: 4165,
      customers: 2263,
      orders: 1070,
    },
  };
  await writeFile(
    join(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    join(outputRoot, "reconciliation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify({ outputRoot, ...report }, null, 2));
}

await ensureDir(outputRoot);
await login();
await archiveAdmin();
const rows = await archiveExports();
const urls = await archiveSitemaps();
await archivePublicPages(urls);
await archiveProductImages(rows);
try {
  const suppliedExport = await readFile(
    join(process.cwd(), "docs", "reference-material", "hmfroid-full-productlist.txt"),
    "utf8",
  );
  await archiveProductImages(parseDelimited(suppliedExport));
} catch (error) {
  console.warn(`Supplied product export unavailable: ${error.message}`);
}
await finish(rows, urls);

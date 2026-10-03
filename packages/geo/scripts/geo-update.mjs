#!/usr/bin/env node
// Downloads the DB-IP Lite City database (CC BY 4.0, https://db-ip.com) for local lookups.
// Run monthly. Target: $QUBO_GEO_DB or <repo>/.private/geo/dbip-city-lite.mmdb.
import { createWriteStream, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const target = resolve(process.env.QUBO_GEO_DB ?? `${root}/.private/geo/dbip-city-lite.mmdb`);
mkdirSync(dirname(target), { recursive: true });

const month = (offset) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - offset);
  return d.toISOString().slice(0, 7);
};

for (const m of [month(0), month(1)]) {
  const url = `https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`;
  const res = await fetch(url);
  if (!res.ok || !res.body) { console.warn(`· ${m}: HTTP ${res.status}`); continue; }
  const tmp = `${target}.download`;
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(tmp));
  renameSync(tmp, target);
  console.log(`✓ DB-IP Lite City ${m} → ${target} (${(statSync(target).size / 1e6).toFixed(0)} MB)`);
  process.exit(0);
}
console.error("✗ could not download DB-IP Lite City (tried this and last month)");
process.exit(1);

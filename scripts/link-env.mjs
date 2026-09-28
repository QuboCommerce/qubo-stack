#!/usr/bin/env node
/**
 * Links the monorepo root .env into each app.
 *
 * Next.js only reads .env from its own project directory, and @next/env
 * resets process.env to its cached initialEnv on each call -- so loading the
 * root .env from next.config.ts gets silently wiped. A symlink lets Next's
 * own loader find the file, which works in every build worker.
 *
 * Runs on postinstall. Safe to run repeatedly. In Docker the root .env is
 * absent and env vars come from compose, so this is a no-op.
 */
import { existsSync, lstatSync, readdirSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnv = join(repoRoot, ".env");

if (!existsSync(rootEnv)) {
  console.log("[link-env] no root .env found, skipping");
  process.exit(0);
}

const appsDir = join(repoRoot, "apps");
if (!existsSync(appsDir)) process.exit(0);

for (const app of readdirSync(appsDir)) {
  const appPath = join(appsDir, app);
  if (!existsSync(join(appPath, "package.json"))) continue;

  const target = join(appPath, ".env");

  let existing = null;
  try {
    existing = lstatSync(target);
  } catch {}

  if (existing) {
    // Never clobber a real file a developer wrote by hand.
    if (!existing.isSymbolicLink()) {
      console.log(`[link-env] ${app}/.env is a real file, leaving it alone`);
      continue;
    }
    unlinkSync(target);
  }

  symlinkSync(rootEnv, target);
  console.log(`[link-env] linked ${app}/.env -> root .env`);
}

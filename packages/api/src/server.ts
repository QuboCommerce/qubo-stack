import { purgeInboxFiles, wakeSnoozed } from "@qubo/inbox/server";
import { triageDue } from "@qubo/inbox/ai";
import { checkDue } from "@qubo/domains/server";
import { storageConfigured } from "@qubo/storage/server";
import { startHeartbeatLoop } from "@qubo/portal-client";
import { app } from "./index";

const port = Number(process.env.PORT ?? 3333);
// qd sets HOST=127.0.0.1 so dev servers are only reachable through the edge proxy.
const hostname = process.env.HOST ?? "0.0.0.0";

app.listen({ port, hostname }, () => {
  console.log(`[qubo-api] listening on ${hostname}:${port}`);
});

// Portal heartbeat (no-op while unlinked). The API process is the one long-lived server-side runtime.
startHeartbeatLoop();

// Snoozed inbox threads wake up on time even when nobody has the admin open.
setInterval(() => void wakeSnoozed().catch((e) => console.error("[inbox] wake failed", e)), 60_000).unref();

// Expired chat files and abandoned reply drafts leave storage; the thread keeps their names.
const purge = () => void (storageConfigured() ? purgeInboxFiles() : Promise.resolve(0)).catch((e) => console.error("[inbox] file purge failed", e));
setTimeout(purge, 30_000).unref();
setInterval(purge, 3_600_000).unref();

// AI triage for organisations that turned it on with their own key. Single-flight: a slow
// provider must not stack sweeps on top of each other.
let triaging = false;
setInterval(() => {
  if (triaging) return;
  triaging = true;
  void triageDue()
    .catch((e) => console.error("[inbox-ai] sweep failed", e))
    .finally(() => (triaging = false));
}, 5_000).unref();

// Custom domains: re-checks DNS on a schedule (eager right after a domain is added) and
// verifies a domain the moment its records hold; the edge picks it up on its next poll.
let checkingDomains = false;
setInterval(() => {
  if (checkingDomains) return;
  checkingDomains = true;
  void checkDue()
    .catch((e) => console.error("[domains] sweep failed", e))
    .finally(() => (checkingDomains = false));
}, 15_000).unref();

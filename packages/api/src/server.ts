import { wakeSnoozed } from "@qubo/inbox/server";
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

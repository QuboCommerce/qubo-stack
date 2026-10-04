---
name: qubo-e2e-testing
description: Verifying Qubo in a real browser with Playwright against the dev hosts, including forging admin sessions, multi-user scenarios and screenshots. Use whenever a UI change must be proven, not assumed.
---

# End-to-end verification

No Playwright test suite is committed yet; verification scripts are written ad hoc and run
against the live `qd` services. Keep them in `/tmp/shots` (never in the repo) unless a
reusable suite is being added.

## Setup

```js
// NODE_PATH=$(pwd)/node_modules node script.mjs
import { chromium } from "playwright-core";
import { globSync } from "node:fs";
const [executablePath] = globSync(`${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell`);
const browser = await chromium.launch({ executablePath, args: ["--host-resolver-rules=MAP *.dev.by-ali.dev 127.0.0.1, MAP dev.by-ali.dev 127.0.0.1"] });
```

`ignoreHTTPSErrors: true` is not needed: the edge serves real Let's Encrypt certificates.

## Admin session without a password

Cookie `__Secure-qubo-admin.session_token` =
`encodeURIComponent(token + "." + base64(HMAC_SHA256(key = BETTER_AUTH_SECRET, data = token)))`.
Insert a row in `session` (`token`, `user_id`, `expires_at`, `ip_address`, `user_agent`).
For a second user: insert `user` (role STAFF) and `organization_member`, then delete both
after the run.

## Multi-user flows

One browser, two `browser.newContext()` calls with different cookies. Presence, leases,
form merges and sessions-geo were all verified this way; reuse that shape.

## What counts as verified

- A real HTTP status and body from the dev host, not a unit test alone.
- For UI: a screenshot read back, or an assertion on visible text.
- Test data restored and temp users deleted.

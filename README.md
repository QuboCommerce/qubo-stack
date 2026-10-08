# Qubo

Qubo is a self-hosted CMS, site builder and back office. One instance runs several
organisations and sites: a visual page editor (Puck), products and stock, orders, an inbox,
custom domains and SEO, all on your own server.

- `apps/qubo-admin`: the admin panel (Next.js)
- `apps/qubo-storefront`: renders every site by host (Next.js)
- `packages/api`: the API (Elysia on Bun)
- `packages/*`: shared `@qubo/*` packages

Setting up a server: [`docs/VPS.md`](docs/VPS.md). Architecture and decisions:
[`HANDOFF.md`](HANDOFF.md).

## Licence

Qubo is released under the [Functional Source License 1.1, MIT Future License](LICENSE.md)
(FSL-1.1-MIT).

What you can do:

- read, run, modify and self-host Qubo for your own business;
- install and run it for a client as a professional service;
- use it in production, commercially, for free;
- fork it and share changes under the same licence.

What you can't do:

- offer Qubo, or a modified copy, as a hosted product or service that competes with Qubo.

Each release becomes available under the MIT licence two years after it is published.

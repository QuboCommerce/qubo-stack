# Changesets

Qubo ships as one product: the admin, storefront, API and shared packages share a
single version (the `fixed` group). `@qubo/protocol` (instance ↔ Portal ↔ Cubicles
contract) is versioned on its own.

- Describe a change: `pnpm changeset` (pick the bump; patch while 0.0.x).
- Release: `pnpm version-packages` → commit → tag `vX.Y.Z` (release flow: Phase 8).

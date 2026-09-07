# Legacy Codex

Legacy Codex is the canonical human-facing product for preserving context, clarifying what matters, choosing the next meaningful action, and resuming without rebuilding the whole situation.

## The one answer

- **Canonical repository:** `edwardemoryphotography/legacy-codex`
- **Canonical production URL:** `https://legacy-codex.vercel.app`
- **Primary loop:** `Capture -> Clarify -> Constrain -> Choose -> Act -> Resume`

Foundry is the builder and operations environment behind Legacy Codex. Routing, evidence, events, and control-plane infrastructure are internal capabilities, not separate products the owner must coordinate during normal use.

## Start here

1. `AGENTS.md` — repository instructions and verification gates.
2. `docs/architecture/legacy-codex-product-definition.md` — canonical product boundary.
3. `docs/architecture/canonical-source-graph.md` — where each kind of truth lives and what is historical.
4. `docs/architecture/data-ownership.md` — canonical tables and transitional stores.
5. `PROJECT_STATUS.md` — dated implementation and deployment state.

The cross-system cognitive doctrine remains the Goose Cookbook in `edwardemoryphotography/codex-system-architecture/notion-wiki/docs/GOOSE-COOKBOOK.md`.

## Local development

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev
```

The application requires a Next.js-aware deployment because `/api/analyze` is a server route. Never infer production behavior from a successful local build or merged pull request.

## Release naming

The product name is **Legacy Codex**. Historical labels such as v24, v27, v35.3, and v38 are provenance, not the current product identity. Future public versions are ordinary software release tags created only when an actual release policy needs them.

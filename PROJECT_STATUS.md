# Legacy Codex — Current Project Status

**Last reconciled:** 2026-08-31

**Canonical repository:** `edwardemoryphotography/legacy-codex`

**Canonical checkout:** `~/legacy-codex`
**Canonical production URL:** `https://legacy-codex.vercel.app`

This file is dated coordination state. Recheck GitHub, Vercel, and the live product before promoting any claim. The source-of-truth map is `docs/architecture/canonical-source-graph.md`.

## Current product milestone

Make the human execution loop usable from the single canonical Legacy Codex front door:

`Capture -> Clarify -> Constrain -> Choose -> Act -> Resume`

The next move is a product outcome, not another repository-cleanup loop: use the Mission screen with a real mission and verify that it preserves enough context to resume and act without reconstructing the architecture.

## Verified baseline before this consolidation branch

| State | Evidence |
| --- | --- |
| Merged | `origin/main` at `a778bb2c705fda8b0bc8edae036cfc45b1f2fbfa`, including the honest `/api/analyze` auth-misconfiguration response from PR #63 |
| Deployed | GitHub/Vercel deployment records show that SHA on the projects named `frontend`, `legacy-codex`, `codex-starforge-dashboard`, and `legacy-codex-vercel-diagnostic` |
| Runtime verified | Direct browser check on 2026-08-31 loaded the Mission screen at `legacy-codex.vercel.app` and completed anonymous sign-in |
| Live | `https://legacy-codex.vercel.app` is the canonical reachable product URL |

The same-SHA duplicate `https://legacy-codex-kappa.vercel.app` failed anonymous sign-in during the same browser check. The duplicate projects are therefore not behaviorally equivalent and must not be retired or receive the canonical alias until configuration parity is proven.

## Consolidation decisions

- Root Legacy Codex app — **CANONICAL**.
- Foundry Console — **INTERNAL COMPONENT**, with a deliberately separate owner-auth boundary until it can be exposed safely behind the canonical product.
- Codex Control Panel — **MIGRATE INTO CANONICAL**. Human-facing next-move routing moves into the Mission screen; guarded Foundry persistence remains transitional.
- `codex-system-architecture` — **ARCHITECTURE / GOVERNANCE**.
- Artful Intelligence — **SEPARATE — ON PURPOSE**.
- Static Consolidation tab — **SUPERSEDED** by the source graph and this dated status file.
- Historical version labels — **HISTORICAL**, not current product naming.

## Known contradictions and remaining gates

1. The Vercel project named `frontend` owns `legacy-codex.vercel.app`; the better-named `legacy-codex` project is not configuration-equivalent yet.
2. The canonical `frontend` project has browser Supabase variables but is missing the unprefixed server auth variables required by `@supabase/server`; `/api/analyze` cannot be called a verified production flow yet.
3. Human missions and Foundry actions now have an explicit boundary, but `evidence_snapshots` and `mission_events` remain transitional stores in production code.
4. Control Panel's owner-gated `persist_route_atomic` transport still depends on server-only configuration in the standalone service. Do not expose or copy service-role credentials into browser code.
5. Old branches and deployment projects remain archaeology until their domain/configuration dependencies are checked. Do not delete them by age or name alone.

## Release gates

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

After merge: verify the exact production deployment, load the Mission screen, exercise Choose the Next Move with real text, check mobile overflow, and confirm there are no new browser console errors.

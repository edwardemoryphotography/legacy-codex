| Merged | `origin/main` at `2bcf8e401490f9659cc17d9780a0de7b28535491` |
| Deployed | Canonical Vercel project `frontend` production deployment `dpl_yvzgfdQFiLL1WP79rzYUGf9YKR8P` is `READY` at the exact merged SHA. |
| Runtime verified | 2026-09-07 persistent production session completed save → start → note → pause → reload → resume with mission `8d561af2-1c61-4302-8f4e-6d97f5423448` and exactly one action `df2f3ffe-137b-4a73-862a-bcfdd417969c`. The saved ID/note survived reload; no duplicate or application error occurred. `POST /api/analyze` now returns the correct unauthenticated 401 boundary instead of the reproduced configuration 500; Vercel reported no runtime errors in the verification window. |# Legacy Codex — Current Project Status

**Last reconciled:** 2026-09-07

**Canonical repository:** `edwardemoryphotography/legacy-codex`

**Canonical checkout:** `~/legacy-codex`
**Canonical production URL:** `https://legacy-codex.vercel.app`

This file is dated coordination state. Recheck GitHub, Vercel, and the live product before promoting any claim. The source-of-truth map is `docs/architecture/canonical-source-graph.md`.

## Current product milestone

Make the human execution loop usable from the single canonical Legacy Codex front door:

`Capture -> Clarify -> Constrain -> Choose -> Act -> Resume`

The human execution loop is now production-verified in a persistent real session: one real mission was captured and promoted; exactly one linked action was saved, started, paused with a note, reloaded as Ready to resume with the same ID and note, and resumed without an error or duplicate. Recovery of Eddie's historical anonymous identity specifically from his original physical iPhone remains a distinct device/session-continuity check, not an unresolved defect in the verified general workflow.

Since 2026-08-31: Mission Right Now emphasis (#66); Orb/Beam Mission redesign (#68, #70); mission-aware next move + connection recovery (#71); save/resume mission-linked next actions (#72) repaired (#73); evidence CI fix (#67); transitions skills (#69).

## Verified baseline

`2bcf8e401490f9659cc17d9780a0de7b28535491` is the verified application-bearing production baseline. It includes PR #76's analyzer-auth repair on top of the Mission save/resume work.

| State | Evidence |
| --- | --- |
| Merged | `origin/main` at `be17ccba9200fac1e43253c09a3f4108f598b280` |
| Deployed | Checked directly against the Vercel API (not only GitHub's status mirror) — `READY` Production deployments at this exact SHA: `frontend` (`dpl_8rXPSVB3FkKYUEsG3mPF7a1fcbwx`), `legacy-codex` (`dpl_CMc8JMWZr3ZVa4UDGAzvvitevW4U`), `codex-starforge-dashboard` (`dpl_CdJHi7wW6os42GM9QVksUMHRPDPc`), `legacy-codex-vercel-diagnostic` (`dpl_5bJANDmgrZJk7DncuYj6CbNbGhUp`) |
| Runtime verified | 2026-08-31 browser check loaded the Mission screen at `legacy-codex.vercel.app` and completed anonymous sign-in. Mission save/resume is shipped on this SHA; owner-session iPhone verification of save / pause / reload / resume is still pending. |
| Live | `https://legacy-codex.vercel.app` is the canonical reachable product URL — confirmed via the Vercel project's domain list to belong to project `frontend` |

The 2026-08-31 check also found that the duplicate `https://legacy-codex-kappa.vercel.app` failed anonymous sign-in. The duplicate projects are therefore not behaviorally equivalent and must not be retired or receive the canonical alias until configuration parity is proven.

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
2. `/api/analyze` now reuses the already-configured public browser Supabase project URL when the duplicate unprefixed URL is absent, derives its HTTPS JWKS endpoint, and preserves required user authentication. Full authenticated file analysis still depends on a real signed-in session and a real supported artifact.
3. Human missions and Foundry actions now have an explicit boundary, but `evidence_snapshots` and `mission_events` remain transitional stores in production code.
4. Control Panel's owner-gated `persist_route_atomic` transport still depends on server-only configuration in the standalone service. Do not expose or copy service-role credentials into browser code.
5. Old branches and deployment projects remain archaeology until their domain/configuration dependencies are checked. Do not delete them by age or name alone.
6. PocketForge is a supporting module, not the Legacy Codex front door. Its Convex `agent.ts` contains a previously merged, partially reconciled Daytona/Vercel implementation and does not currently parse; repair requires a separate PocketForge architecture decision rather than an opportunistic consolidation edit.

## Release gates

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Verified after merge: exact production SHA/deployment, real Mission capture and next-move behavior, save / pause / reload / resume of one action, database absence of duplicates, correct analyzer authentication boundary, and no Vercel runtime errors. The original physical-iPhone identity recovery check may still be run separately if continuity with that historical anonymous session matters.

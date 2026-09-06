# Legacy Codex — Current Project Status

**Last reconciled:** 2026-09-06

**Canonical repository:** `edwardemoryphotography/legacy-codex`

**Canonical checkout:** `~/legacy-codex`
**Canonical production URL:** `https://legacy-codex.vercel.app`

This file is dated coordination state. Recheck GitHub, Vercel, and the live product before promoting any claim. The source-of-truth map is `docs/architecture/canonical-source-graph.md`.

## Current product milestone

Make the human execution loop usable from the single canonical Legacy Codex front door:

`Capture -> Clarify -> Constrain -> Choose -> Act -> Resume`

The next move is a product outcome, not another repository-cleanup loop: use the Mission screen with a real mission and verify that it preserves enough context to resume and act without reconstructing the architecture. Save/resume of the same mission-linked next action is now on production; the remaining finish line is owner-session iPhone proof of save, pause, reload, and resume.

Since 2026-08-31: Mission Right Now emphasis (#66); Orb/Beam Mission redesign (#68, #70); mission-aware next move + connection recovery (#71); save/resume mission-linked next actions (#72) repaired (#73); evidence CI fix (#67); transitions skills (#69).

## Verified baseline

`be17ccba9200fac1e43253c09a3f4108f598b280` is the last verified **application-bearing** production baseline before this coordination-only PR — it is not a SHA expected to remain "current" once this docs PR merges. Automated evidence-snapshot commits from `evidence-bridge[bot]` (data-only, touching exclusively `public/notes/evidence-snapshot.json`) continue to advance Production independent of application changes: as of this reconcile, Production has moved past `be17ccba` to `1dbdbbe2` and then `27fbb0cd` via exactly two such commits, with zero application source files touched by either.

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
2. The canonical `frontend` project has browser Supabase variables but is missing the unprefixed server auth variables required by `@supabase/server`; `/api/analyze` cannot be called a verified production flow yet.
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

After merge: verify the exact production deployment, then owner-session iPhone proof of save / pause / reload / resume on the Mission next action. Also load the Mission screen, exercise Choose the Next Move with real text, check mobile overflow, and confirm there are no new browser console errors.

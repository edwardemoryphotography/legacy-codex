# Orphaned result investigation — 2026-10-29

Base: `ddb525d` on main. The canonical Goose Cookbook was read from codex-system-architecture. The former app-code freeze is retired in AGENTS.md. This checkout had no uncommitted changes.

## Finding and implementation map

The review POST reads account-scoped mission context, validates model output and rechecks context before inserting `delta_reviewed` in `mission_events`; a write error returns failure. GET restores only the newest review whose mission, finish line, context and source validation match and whose age is at most one hour. Thus persisted older reviews had no historical UI read path. This is a source-level finding, not an observed owner workflow.

| Transition | Mechanism and status |
| --- | --- |
| Mission and context | MissionTab and `loadProjectContext`, authenticated account/RLS reads; implemented, real current runtime unverified. |
| Proposal and persistence | `/api/delta-review` validates and writes `delta_reviewed`; implemented and existing regression-tested, actual commit/read-back unverified in this session. |
| Current restoration | `cachedProjectReview` validates current context and expiry without a model call; implemented, tested in existing suite; real reload unverified. |
| History | Latest saved event is now separately read and displayed as historical, never fed to the active recommendation or confirmation; local logic tested, real runtime unverified. Earlier records remain stored but this view does not page them. |
| Correction | `delta_corrected` feeds inhibition and context; implemented and tested; a real end-to-end correction/reload was not observed. |
| Action | `actions` owns commitments; recommendations and acceptance are distinct from completion. Save/resume workflow not observed here. |
| Lesson | Explicit scoped confirmation and retirement in `mission_events`; implemented and tested, no real confirmation observed here. |
| Transfer | Source-grounded structural bridge and bounded intervention measurement exist; sequential comparisons are confounded and classification remains Unknown. No authentic pair or independent outcome verified here. |

The October 16 audit documented zero review and confirmation rows at that time; it is not evidence of current database state. No owner credentials or authenticated mission were available in this checkout. No production records were created or changed. The latest history view shows source identifiers/labels from the frozen record, and does not assert those sources remain current. It does not show the entire review or older events; a complete historical browsing workflow remains open.

## Remaining proof and resume capsule

On the authorized owner account, use an existing mission and real review: confirm the saved event and owner/mission association, reload within the freshness window, then revisit after expiry or a context change. Verify the historical proposal appears without becoming actionable and inspect correction, action, and lesson continuity. Demonstrating inheritance additionally requires a previously confirmed lesson, a later same-account structural analogue, no repeated correction, and independent outcome evidence. No causal transfer is claimed. No schema or deployment configuration changed.

Local checks: `npm test -- --run src/lib/reviewHistory.test.ts` passed (2 tests); `npx tsc --noEmit` passed; `npm run lint` passed with nine existing warnings. These checks do not establish authenticated persistence or inheritance. `CI=1 npm test -- --run --maxWorkers=2` passed (50 files, 505 tests); `npm run build` passed. The final UI adjustment was type-checked separately while the build and suite were running; authenticated runtime remains unverified.

## Release checkpoint

The owner-scoped history query is read-only and is never passed to the active proposal or lesson-confirmation paths. The blocked-primary fallback restores history when no secondary exists; a UI regression test exercises that case without creating an action. Historical records are only shown for the selected review target, and the latest record alone is exposed. Expiry and context validation of the active cache are unchanged. This is implementation and test evidence, not a real database read.

Committed: see the containing commit. Merged: pending. Deployed: pending. Runtime verified: no. Actual user workflow verified: no. CI and deployment evidence belong in the PR/release record when available.

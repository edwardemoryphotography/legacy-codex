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

The implementation was committed, merged and deployed; see the release observation below. Authenticated review runtime and the actual user workflow remain unverified.

## Release observation — 2026-10-28 Pacific

Implementation commit `2d15426859961174bd5c1eeaf16da9ac5d3a8594`; [PR #130](https://github.com/edwardemoryphotography/legacy-codex/pull/130) merged as `4c033a32c0f4fa1b5effc4cc87f64df849c7188b`. [CI](https://github.com/edwardemoryphotography/legacy-codex/actions/runs/40795593808) passed lint, type check, tests and build on the final implementation. The canonical frontend production deployment is [dpl_DKFBPPDS9NpuVAQAFhAQ1qdPKrGB](https://vercel.com/edwardemoryphotographys-projects/frontend/DKFBPPDS9NpuVAQAFhAQ1qdPKrGB), READY for merge commit `4c033a3`; Vercel reports the canonical domain assigned to it. The production homepage returned HTTP 200 and its served JavaScript contained the historical-review label. This verifies delivery of the code, not an authenticated review read. Actual review runtime and user workflow verification remain unproven; no owner session was available.


## Production forensic follow-up — 2026-10-28 Pacific

The canonical domain resolves in Vercel to `frontend` project `prj_irrXhfz1elCLhO1Pdgd0ffM4wfz2`, deployment `dpl_DKFBPPDS9NpuVAQAFhAQ1qdPKrGB`, READY on merge commit `4c033a3`. The served browser bundle identifies Supabase project `pkydkbuodikttfeawqsw` (foundry-console). This confirms the browser data target. Server authentication uses `SUPABASE_URL` before `NEXT_PUBLIC_SUPABASE_URL`; Vercel denied access to environment metadata (403), and no Vercel CLI was installed, so the server target is **not independently verified**. The artful-intelligence project was not queried or substituted.

Read-only SQL against `pkydkbuodikttfeawqsw` returned 41 missions, **0 `delta_reviewed`**, 0 `delta_lesson_confirmed`, 29 `delta_accepted`, 2 corrections, and 20 mission-linked actions. Counts are at observation time; no identity or private mission contents are recorded here. With zero reviews in this database, a history read against it has no saved review to display for any account. That does not establish whether a review was attempted, a provider or insert failed, the screen displayed another kind of operation, or the server used a different target. The actual owner session and selected mission were not observed. Do not infer the cause of an earlier attempt from this absence.

RLS is enabled on missions, mission_events and actions. The event insert policy requires both matching authenticated user and ownership of the linked mission; event selects require matching user. The route also filters history by user and mission. Source inspection shows POST returns a review only after successful insert or a valid idempotency winner, with failures reported; GET applies the separate one-hour active cache and returns historical data separately. These are source and test findings, not observed authenticated writes or reads. The unauthenticated production capability endpoint returned 401. A 30-minute runtime log search found no matching log lines; Vercel rejected the 24-hour query because of retention limits. Neither result establishes the absence of prior attempts or errors.

No production data or configuration was changed. No new application fix is justified by the available evidence. Remaining proof: an authorized owner session and a genuine existing or ordinarily generated review, followed by its real event and authenticated read-back. No review should be manufactured for testing. Inheritance remains **Unknown**. The evidence-only release update from `b405ef5` was incorporated into this document.

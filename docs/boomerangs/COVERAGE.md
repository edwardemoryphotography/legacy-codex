# Boomerang source coverage and reconciliation — November 10, 2026

Scope: the 34 records in [`src/lib/boomerangCasebook.ts`](../../src/lib/boomerangCasebook.ts) at `a2275f7`, plus the first real incident candidate in [`src/lib/incidentCandidates.ts`](../../src/lib/incidentCandidates.ts). This is a dated observation. It does not claim the corpus is complete.

## What was examined, and how far

| Check | Result | Limit |
| --- | --- | --- |
| Public citations resolve | 48 public citations, 18 distinct URLs: 8 repository files exist on `main`, 10 PRs are merged (#58, #116, #118–#122, #185–#187) | A resolving link shows the source exists. It was **not** checked sentence by sentence that each source supports each record |
| Substantive support read in full | BR-034 only (PRs #185, #186, #187, #188 bodies) | The other 33 records were read as written; their sources were not re-read against each claim |
| Restricted origin sources | 16 citations point at owner-only Notion archives (Nov 2–3 2025, Aug 9 2026, Oct 7 2026) | **Not opened in this pass.** Nothing from them is in the repository |
| Production learning ledger | Read-only aggregate, all accounts: 0 `delta_reviewed`, 0 `delta_lesson_confirmed`, 0 `delta_lesson_retired`, 2 `delta_corrected` (latest 2026-09-02) | Counts only; no row contents were read or written |
| Real projects showing repeated failed attempts | **Unknown.** Row counts only: 0 of 43 missions have two or more saved corrections; 0 have a saved blocker | Counts cannot show whether attempts concerned the same symptom or shared a cause, and most real work is never saved as corrections. An empty history is not evidence that no applicable task exists |

## Disputed interpretation found

BR-034 says “three attempts to patch a clipped iPhone tool flyout failed.” The PRs say otherwise: #185 and #186 were offset patches aimed mainly at the keyboard and composer (the menu clipping is noted in passing), and #187 was a structural replacement that the owner later accepted. Two patches then one replacement, not three failures. PR #187’s own text says iPhone acceptance was still outstanding; the acceptance is the owner’s later report (PR #188 and the November 10 directive), and no device record of the accepted state is public. BR-034 keeps its ID and text; the correction lives in incident candidate `IC-001`, which is the superseding reading.

## Deduplication by causal mechanism (builder reading — needs owner review)

Grouped from each record’s shared-structure line. IDs are unchanged and no record was merged or renamed. By this reading the 34 labels describe about 13 distinct mechanisms, not 34.

| Mechanism | Records |
| --- | --- |
| Evidence for one stage is taken as evidence for the next | BR-001, 013, 019, 026, 030, 031, 033 |
| Keep the method that produced the result, not only the result | BR-006, 008, 011, 025 |
| The same relationship survives a change of form or vocabulary | BR-004, 009, 012, 016, 029 |
| One dated authority per truth | BR-002, 017, 018, 021, 022 |
| A known fact or correction must reach everything that depends on it | BR-014, 020, 024, 027, 028 |
| Stand alone | BR-003, 005, 007, 010, 015, 023, 032, 034 |

## Evidence layers

Every record in Codex → Root → Boomerang Casebook now shows six separate statements — observed source fact, historical interpretation, cross-domain hypothesis, implemented guard, user-verified incident, independently observed future transfer — instead of one status word. They are never combined into a score. Every record’s last layer reads “Not demonstrated.”

## Absent primary evidence (still unknown)

- 2015–2017 handwritten notes and the original 2019 material: not recovered.
- The earlier 18-item retrospective: only its category outline exists. Not reproduced.
- Any device capture of the accepted iPhone fix.
- Any human-confirmed lesson, and any later decision changed by one. None exists in production.

## Lexical retrieval on the real incident text (one pair each, not a benchmark of scale)

Using the unchanged `relatedProjectSignal` and the IC-001 text: a real sentence with the same mechanism in different words (AGENTS.md, “Repeated Supabase/Vercel configuration rediscovery is a system failure”) scores **1**, below the selection threshold of 2 — missed. A real sentence with shared iPhone words and an unrelated mechanism (STATE.md, Home Screen icons note) scores **4** — selected. The new structural precondition counts saved corrections, supplied steps and a blocker instead of words; on current production data it matches nothing, so its usefulness is unmeasured.

## Corrections after independent review of PR #189 (November 10)

**IC-001 is manually authored.** A developer session read PRs #185–#187 and wrote the record by hand. Legacy Codex did not notice the incident, reconstruct it, or propose the lesson. Every future candidate currently needs the same manual edit and a deploy. The record says so in its `authorship` field, which the owner sees.

**Next smallest step toward Codex proposing candidates itself (not built).** Project review already drafts a `lesson` from a mission’s real saved rows and caches it in `delta_reviewed`. Extend that one existing proposal to the incident shape (dated attempts quoted from saved rows, contradictions, exceptions, `mechanism`), and have `GET /api/delta-lessons` list those cached proposals beside the repository records. The owner gate, ledger, lifecycle and consumers stay as they are; no new table or event store. That covers experiences saved in missions. Incidents that live only in pull requests would still need a way in, and none is proposed here.

**Structural recognition is a prompt, not a finding.** `mechanismPrecondition` now returns only `possible` or `unknown`. Two saved corrections may be about unrelated things, so counts never establish the precondition; the note sends the reviewer to the sources with four separate questions (distinct attempts, same symptom, a named causal relationship, independent evidence).

**What is simulation and what is evidence.**

| Kind | Where | What it shows | What it does not show |
| --- | --- | --- | --- |
| Test-only simulation | `src/app/api/delta-lessons/route.test.ts` (made-up mission ids, stubbed sign-in, an array imitating the ledger) | The route’s branching is self-consistent | Anything about production, a real owner, or learning |
| Real public sources | `npm run verify:incidents` (live GitHub API) | PRs #185–#187 exist, are merged at the recorded times in order, and their texts contain the cited approaches. Passed November 10 | The owner’s iPhone acceptance; any later use of the rule |
| Real database, read-only | Production index `mission_events_idempotency`: unique `(user_id, idempotency_key)` where the key is not null | The constraint the one-slot-per-confirmation rule depends on exists | That the deployed route has ever exercised it; no confirmation row exists |
| Real behaviour | None | — | No owner confirmation, no later task, no changed decision |

**Lifecycle.** Every decision on a candidate, confirmation or rejection, takes the next numbered slot per account, `lesson:incident:<id>:g<n>`. Simultaneous decisions of any kind, wording or mission collide on the real unique index and exactly one is stored, so a rejection and a confirmation cannot both win a generation. A retired rule can be confirmed again in identical words (next slot); earlier rows are never changed. Rejection is refused while a rule is active.

**Mission attribution.** The ledger requires a mission for every row. The owner must now pick it; nothing is preselected. Known limit: cross-project transfer measurement treats the chosen mission as the lesson’s origin, which is not where a repository incident happened.

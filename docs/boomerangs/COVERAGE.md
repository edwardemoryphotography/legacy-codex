# Boomerang source coverage and reconciliation — November 10, 2026

Scope: the 34 records in [`src/lib/boomerangCasebook.ts`](../../src/lib/boomerangCasebook.ts) at `a2275f7`, plus the first real incident candidate in [`src/lib/incidentCandidates.ts`](../../src/lib/incidentCandidates.ts). This is a dated observation. It does not claim the corpus is complete.

## What was examined, and how far

| Check | Result | Limit |
| --- | --- | --- |
| Public citations resolve | 48 public citations, 18 distinct URLs: 8 repository files exist on `main`, 10 PRs are merged (#58, #116, #118–#122, #185–#187) | A resolving link shows the source exists. It was **not** checked sentence by sentence that each source supports each record |
| Substantive support read in full | BR-034 only (PRs #185, #186, #187, #188 bodies) | The other 33 records were read as written; their sources were not re-read against each claim |
| Restricted origin sources | 16 citations point at owner-only Notion archives (Nov 2–3 2025, Aug 9 2026, Oct 7 2026) | **Not opened in this pass.** Nothing from them is in the repository |
| Production learning ledger | Read-only aggregate, all accounts: 0 `delta_reviewed`, 0 `delta_lesson_confirmed`, 0 `delta_lesson_retired`, 2 `delta_corrected` (latest 2026-09-02) | Counts only; no row contents were read or written |
| Real projects showing repeated failed attempts | 0 of 43 missions have two or more corrections; 0 have a saved blocker | So no real later task currently meets the first incident rule’s precondition |

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

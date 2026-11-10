# Legacy Codex — Boomerang Catch and Inherited Capability
## Build directive for Fable 5.2 / Gemini 4 Argon / Astra
**Owner's governing task:** Make Legacy Codex learn from the *structure of real experience* so future work benefits without the human re-explaining the same lesson. Do not optimize for accumulating memories, clever analogies, prompts, pretty UI or another architecture diagram. Deliver working, reviewed, evidence-grounded behavior in the EXISTING Legacy Codex product.

### Non-negotiable environment and authority
- Work exclusively in `edwardemoryphotography/legacy-codex` (Next.js/React) with the existing live frontend `https://legacy-codex.vercel.app`, Vercel project **frontend**. Foundry is builder infrastructure, not another product. Do not create a second app, front door, repo or parallel canonical data store.
- Canonical doctrine is `edwardemoryphotography/codex-system-architecture/notion-wiki/docs/GOOSE-COOKBOOK.md`. Read `AGENTS.md`, `STATE.md`, `PROJECT_STATUS.md`, `TODOS.md`, `docs/architecture/data-ownership.md`, `docs/verification/builder-continuity-2026-10-31.md`, `docs/verification/structural-transfer-2026-10-16.md`, and `docs/boomerangs/README.md` before deciding design.
- **Start from the real recovered casebook:** `src/lib/boomerangCasebook.ts`, currently **34 source-annotated historical records**, exposed in **Codex → Root → Boomerang Casebook**. These are historical source analysis, not 34 confirmed learned production lessons and not proof of transfer.
- Source-rich owner-only origin records can be inspected when authorized: Notion **Nov 2–3, 2025 Complete Session Archive**, **Aug 9, 2026 Goose Recursion origin**, and **Oct 7, 2026 MasterChef — Carry the Discernment and the Care**. Their private content must not be published to the public GitHub repository. Earlier **2015–2017 handwritten notes and original 2019 material were not recovered**. Record missing coverage rather than inventing sources.
- Use only real repo files, actual GitHub PRs, source-verified docs, actual saved missions/actions/evidence, and authorized actual owner sessions. **NO MOCK DATA, SYNTHETIC HISTORIES, FICTIONAL USERS, FABRICATED BOOMERANGS, OR SIMULATED PROOF.** Do not seed production lessons, events or fake confirmations to make dashboards look populated.
- Honor current user intent and auth. No credential changes, destructive migrations, broad production grants, arbitrary model self-modification, background agents or irreversible data changes without specific authorization. Keep secrets server-side and RLS account-scoped. Human confirms learning that affects their future decisions.

### Governing benchmark
A boomerang is more than two similar words. It is a defensible bridge:
**real source → real target → shared underlying causal structure → explicit reasoning bridge → practical consequence → disconfirming evidence and required proof.**

Successful **inherited capability** means a confirmed, applicable lesson materially changes a **later, different real reconstruction or decision without the original user having to repeat the correction**, with provenance and independent outcome evidence. Mere retrieval, system-prompt inclusion, a green PR, a changed sentence, or the model's own declaration are not acceptable substitutes.

### Phase 1 — Source archaeology and reconciliation
1. Inspect the 34-entry casebook and verify each public citation and its substantive support. Search the existing repo, relevant private owner docs, linked runbooks, archived session records, prior PR corrections and project records for omitted or conflicting historical catches.
2. Deduplicate by **causal mechanism**, not label or keywords. Do not inflate a count by renaming the same rule. Preserve stable IDs; add a supersession reference rather than silently replacing prior interpretations.
3. For each record distinguish **observed source fact, historical interpretation, cross-domain hypothesis, implemented guard, user-verified incident, independently observed future transfer**. Never collapse these into one confidence number.
4. Produce a coverage report showing examined sources, source access restrictions, absent primary evidence, and disputed interpretations. The recovered older 18-item retrospective has only a category outline available; do not claim to reproduce all 18 verbatim. Preserve a user-facing history of what remains unknown.

### Phase 2 — Existing architecture and the real gap
Trace the existing data and runtime paths: `missions`, `actions`, `evidence_items`, derived `evidence_snapshots`, `events`, transitional `mission_events`; `/api/delta-review`, `/api/delta-lessons`, `loadConfirmedLessons`, `learnedContext`, `/api/analyze`, `/api/delta-operation`, and `/api/task-routing`.
Identify where:
- an experience can become a source-backed **candidate**;
- the owner can inspect, correct, reject or confirm the rule and its application conditions;
- confirmed scoped rules are selected for future decisions;
- structural retrieval misses matches because it favors shared words;
- later behavior is measured independently and attributed honestly;
- repeated lessons can be proposed as tests, invariants or architectural improvements instead of being injected only as prose.
Reuse existing stores. If a schema addition is truly necessary, justify with an explicit missing invariant, reversible migration, read parity, RLS and rollback plan. Do not mutate production merely to fill a learning counter.

### Phase 3 — Build the missing learning loop
Implement in the EXISTING app, in small reviewable changes:
1. A **source-backed candidate workflow** for real incidents/PRs and existing mission reviews. Record provenance, time, original problem, attempted approaches, actual observed outcome, contradictions, root mechanism, source→target bridge, scope, when-to-apply, exceptions, and counterevidence.
2. A **cross-domain retrieval pass** that can discover a genuinely similar mechanism when source and target use different words. Use real structured features and source excerpts; benchmark against the current lexical-only retrieval and deliberately test false positives. No black-box semantic score is proof of a relationship.
3. A **human review gate**: user can correct, reject, explicitly confirm for mission or account scope, or retire a rule without erasing history. Historical entries must not auto-enter `delta_lesson_confirmed`. Provide clear source and confidence labels.
4. **Context injection by verified scope only**: future eligible analysis, project review, Strategic Delta-related model assistance and agent handoffs must consume applicable confirmed rules with their conditions and references, respect current user corrections, and avoid overflow/truncation that removes exceptions. Do not make historical casebook candidates hidden system instructions.
5. **Dependent repair**: when a prior claim or lesson is corrected, identify affected recommendations/actions and mark them for reconsideration; do not stop after updating an explanation.
6. **Governed promotion**: repeated source-backed lessons may propose a test, rule, retrieval change, architectural adjustment or PR. Nothing silently self-merges, alters canonical doctrine or writes data without review and legitimate authorization.
7. **Human-facing transparency** in existing Mission/Root surfaces only: show observation → proposed lesson → confirmed rule → later application → actual outcome, with timestamps, inspectable links and honest Unknown when absent. Never animate the orb as if a boomerang was verified merely because a model responded.

### Phase 4 — Independent proof, not a demo with fake data
Use the actual PRs [#185](https://github.com/edwardemoryphotography/legacy-codex/pull/185), [#186](https://github.com/edwardemoryphotography/legacy-codex/pull/186), [#187](https://github.com/edwardemoryphotography/legacy-codex/pull/187) and the owner's real iPhone acceptance as one existing incident:
- repeated fixed-viewport/CSS offset patches did not solve the tools menu;
- the final native top-layer `<dialog>` removed the clipping relationship;
- the owner confirmed the final fix on their phone.
The transferable rule is **when repeated symptom patches fail, inspect the containing architecture and replace the invalid structural relationship**.
This is **not yet** a confirmed production lesson and it has **not** shown transfer to unrelated work. Propose it in the existing workflow with actual linked sources, and only preserve confirmation once the owner approves.
Then evaluate on a *different real task* selected from actual current work. Run a source-bounded baseline and applicable-lesson comparison, record whether the owner supplied new hints, whether the decision materially changed, and what independent outcome was observed. Model sampling and sequential comparison confound attribution; call them limitations. Do not create pretend tasks to force a pass.

### Phase 5 — Release and handoff
- Use one branch/PR per coherent incremental change; avoid the prior pattern of hundreds of low-level patches substituted for the actual cognitive benchmark.
- Run repository builder/immersive contracts, lint, TypeScript, real-source unit/regression checks, production build, and source/provenance/RLS checks where applicable. Keep tests honest; never write fabricated production rows.
- Check the exact Vercel **frontend** deployment commit and canonical alias; distinguish Merged, Deployed, Runtime Verified and Live. For iOS UX, verify both home-screen PWA and ChatGPT embedded webview on the actual device rather than treating desktop screenshots or jsdom as acceptance.
- Deliver a concise technical report with file-level diffs, tests, exact GitHub PR/commit, deployment evidence, real observed before/after result, unresolved source gaps and next acceptance action. Do not say “it learned” until a later real independent decision changed under the confirmed rule.

### Definition of done
A real user can point to an actual experience, see Codex reconstruct the mechanism with source citations and competing explanations, confirm a rule, leave and return to a **different real problem**, and see Codex apply the right rule under its conditions **without being retaught**, with independent evidence and an owner-visible ability to correct or retire it. The app must remain Legacy Codex, not an archive, new dashboard, or another agent project.

Start by **reading the real repository and casebook**, report the highest-risk missing path in plain English, then implement the smallest complete vertical slice all the way through the authorized validation stages. Do not stop at a design document or say that prompt wiring alone is success.

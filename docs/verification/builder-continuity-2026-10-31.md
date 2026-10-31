# Builder continuity correction — October 31, 2026

## The real incident

Source: [Legacy Codex Comparison](https://chatgpt.com/c/6ae46bb8-df20-83e8-8cbe-d33d537ff10d), retrieved through `read_thread` on October 31. The conversation is access-controlled; this document publishes only the operational correction and short regression excerpts, not the private transcript.

The assistant presented the established Goose discovery as a fresh interpretation, made Edward reconstruct context, then acknowledged the correction while continuing with long explanations. After being asked for working software, it introduced an irrelevant discussion of consciousness. The failure was repeated non-application of available doctrine, not a lack of another explanation from the owner. The retrieved conversation establishes the assistant's behavior and Edward's correction; its claims of having read earlier conversations do not independently establish that access.

Source messages:

- `5c242648-5fa2-42e3-a072-814af848b6e6`: Edward identifies the original discovery being presented as an epiphany.
- `d2a264c3-1194-4146-89b9-d23a6984b91b`: assistant acknowledges the August history, then continues the long explanation and unsolicited qualification.
- `daa3278f-88b6-41ed-886d-177a723fbd1b`: Edward identifies this very exchange as the failure the system should learn from.
- `72532017-64cd-4999-8eef-499655f48517`: assistant replies with another extended conceptual explanation.
- `5065eeeb-041b-4c2f-aeed-8f7b0e60aad5` and `ad742284-c0f3-4a7b-8e10-ffdf024ec384`: request for working software followed by another irrelevant philosophical qualification.
- `f05a9750-5e25-4cc7-8e63-beab69c1916e`: Edward explicitly requests durable correction and references the seven-phase protocol.

## Authority and historical protocol

The [canonical Goose Cookbook](https://github.com/edwardemoryphotography/codex-system-architecture/blob/f571e466853f3832f2b1692ad9ae825a51794dc4/notion-wiki/docs/GOOSE-COOKBOOK.md) already records August 9, 2026 under “Reverse engineering the reverse engineering”: the receiving model reconstructed an existing vision from the build. Its “Decompression responsibility” and “MasterChef” rules require reconstruction and demonstration. This incident is a regression against that doctrine, not a new doctrine owner.

The [current seven-phase work protocol](https://github.com/edwardemoryphotography/codex-system-architecture/blob/f571e466853f3832f2b1692ad9ae825a51794dc4/src/content/codexDocumentBodies.ts#L225) is **Orient → Verify → Define → Plan → Execute → Validate → Record**. The source labels it a consolidation of user-confirmed rules. The [older December 2025 migration](https://github.com/edwardemoryphotography/codex-system-architecture/blob/f571e466853f3832f2b1692ad9ae825a51794dc4/supabase/migrations/20251230201822_add_rich_content_protocols_territory.sql#L9) instead contains **Spark → Scope → Structure → Sprint → Synthesize → Ship → Study**. Both exist; the current source is the operational reference here. Neither proves a deployed seven-stage engine. No new protocol is invented, and the exact version Edward intended in conversation remains unknown.

## Required builder behavior

Before interpreting system intent, read the Cookbook and this correction. Recover available context yourself. Attribute the August discovery as established; distinguish a model gaining understanding from the owner's intent changing. Treat a correction as input to the current work: preserve its source, change the relevant instruction/check/behavior, test the original failure, and report the result briefly. Do not introduce consciousness or sentience into an engineering request. Do not require Edward to supply the same history again when connected sources contain it.

Follow the existing seven phases with evidence, not ceremony: identify canonical code and deployment; classify unknowns; define the real human outcome; choose the smallest sufficient repair; implement it; verify the original path; preserve the correction and remaining limits. Instructions govern builders that load them. They are not automatically inherited by external chats or proof of a runtime model's understanding.

## Regression evaluation

Run `npm run check:builder` in CI to confirm the authentic failed responses remain rejected by the mechanical response gate. Before closing a system-level builder task, save the proposed concise outcome outside the tracked tree and run `npm run check:builder -- --response /absolute/path/to/outcome.txt`.

The gate catches unsolicited consciousness discussion, specific novelty/rhetoric patterns from this incident, excessive response length, and missing artifact/blocker reporting. Its negative cases are short verbatim excerpts with source message IDs in `builder-continuity-cases.json`; no invented user, mission, model answer or success fixture is used. A passing gate is only a mechanical result. It does not verify URLs, source reading, semantic understanding, truth of claims, accessibility, or successful learning.

Review the substantive result against these criteria: established doctrine is attributed correctly; recovered sources replace repeated owner explanation; a correction changes a durable control; the existing application receives a concrete repair or a specific evidenced blocker; authentic data stays authentic; and Merged, Deployed, Runtime Verified and Live remain separate. Any missing evidence stays unknown. CI cannot certify these judgments from keywords.

## Current product route and observed limits

Baseline: `origin/main` at `3cfedc9ba81fb28014854c864a15d0489c801e87`. The canonical checkout was on `feature/converse`, 153 commits behind main with unrelated local work; it was preserved. The isolated branch starts at current main.

Vercel production project **frontend**, `prj_irrXhfz1elCLhO1Pdgd0ffM4wfz2`, served that exact commit in READY deployment `dpl_HiP4ArYWnAtyHuCRMs32F1DT1Mzu` at [the canonical app](https://legacy-codex.vercel.app). GitHub and Vercel CLI authentication both identified the owner. This proves deployment identity, not the human workflow.

An existing production browser tab showed Home with no missions and “Add a mission first: open the menu, then Mission.” The visible tools depend on a saved mission and model access; the existing Mission workflow supplies the narrower save/next-move/pause/resume route. This patch adds one direct button into that screen: **Start a mission** after a confirmed empty read, **Open your missions** after a successful non-empty read. Loading and failed reads never become a first-run invitation. The existing screen, data model, auth, owner restrictions, and styles are reused.

An existing browser account was awaiting an email code. No code was requested or entered, account replaced, owner permission changed, or production mission created. Another real person opening the app, saving their own meaningful work, pausing, returning after reload and resuming the same work remains the acceptance test. Real model assistance and later lesson transfer require separate evidence. The button alone does not establish either.

## Verification of this patch

- `npm run check:builder`: all three authentic failure excerpts rejected for their recorded failure reason.
- `npm run lint`: zero errors, nine warnings in unchanged files.
- `npx tsc --noEmit`: passed.
- `CI=1 npm test -- --run --maxWorkers=2`: 52 files / 523 tests passed, including 12 Home cases. These are automated contracts with existing mocked infrastructure, not real-human proof.
- `npm run build`: passed on Next.js 16.3.0. No framework version changed.
- `git diff --check`: passed.
- Read-only production browser navigation reached Mission's connected, empty entry form and its explicit non-owner AI restriction. No mission, action or lesson was submitted. An isolated verification browser worked after the original Chrome connection repeatedly timed out.
- Current baseline dependency audit: 29 advisories (20 moderate, 8 high, one critical package). `next` is among the reported packages. This contradicts the older “clean audit” instruction; the lockfile is unchanged and advisory applicability/remediation is not established by this patch. No automatic audit fix or downgrade was run.
- Active Vercel projects `frontend`, `foundry-console` (replacement domain), and `artful-intelligence` all returned READY production deployment metadata during discovery. No settings were changed.

Commit, PR, preview/production deployment identity, and direct runtime observations must be recorded separately as they become available. The real-human save → pause → reload → resume and learned-transfer outcomes remain unverified.

# PocketForge — Native Legacy Codex reconciliation (2026-11-24)

## Product boundary
Legacy Codex remains the canonical human product and source of mission, action, evidence, correction, lesson and decision semantics. PocketForge is a native interface to it, not a competing intelligence store. Foundry remains internal execution and verification. Preserve the original mobile builder as a clearly scoped capability; do not equate generated app deployment with verified action completion.

## Source findings (GitHub source read 2026-11-24; not runtime evidence)
- `pocketforge/ios/PocketForge.xcodeproj` and `PocketForgeIntents.swift` already exist. Existing App Shortcuts capture a thought, read an LAR next action, and open Inbox.
- `PocketForgeAPI.swift` has Supabase owner login/session refresh, Keychain persistence, bearer-authenticated Codex calls, direct reads of `routed_requests` and `evidence_items`, inserts in `nd_captures`, and a Foundry routing RPC. AppConfig targets the same named Supabase project and Codex web host by default. Actual installed build configuration, RLS, deployment and device session are unverified.
- `WhatsMyNextActionIntent` calls `CognitionDeriver.lar` on routed requests and evidence; this is **not** the modern Strategic Delta decision. Do not relabel it as such.
- `src/lib/nextAction.ts` models saved commitments, accepted moves, predictions, insufficiency, stale context, errors and canonical action IDs distinctly. `src/lib/strategicDelta.ts` has a shared deterministic prediction engine; `/api/delta-operation` supplies only a bounded candidate, not a full decision. No Swift reimplementation of either decision engine.
- `src/app/api/pocketforge/context/route.ts` and `src/app/api/pocketforge/cognition/route.ts` returned 404 when requested at these paths via GitHub. Native client references them; check alternate routing/deployed source before claiming they work.
- Existing `pocketforge/README.md` describes the older unauthenticated Convex mobile builder. Do not assume its deployment or security model is appropriate for native Codex.
- PR #199 (Home strategic reconsideration) was open at inspection; PR #200 (provider chain recovery) and #198 (saved-action display) were reported merged. Do not freeze native contracts against an unmerged branch. Reconcile against the actual deployed/released Home decision.
- Capture intent previously swallowed queue-write errors and claimed success. This branch makes failed local persistence explicit; a transport failure means remote persistence is unconfirmed, not necessarily absent. No build/device verification yet.

## First vertical slice — canonical next move
1. Rebase this isolated branch on the verified release baseline after Home decision work settles. Locate authoritative server-side mission, action, evidence, correction, lesson and acceptance readers. Audit account/owner scoping and RLS; derive from authenticated identity, not caller-supplied user ID.
2. Add or reuse a narrow, read-only, authenticated server projection of the exact shared Home decision (saved action ID and resume note, accepted/predicted recommendation, reasons, source refs, freshness/read failure, clarification or no mission). If Home still composes the decision in the browser, extract common logic rather than duplicating it. Never call delta-operation directly as a complete recommendation. No writes on read.
3. Native client consumes typed projection over existing bearer session. Legacy LAR remains honestly labeled if retained; Siri next-move result must distinguish saved action from a recommendation, stale or incomplete reads from a real result. Reuse real canonical action ID for deep link; do not create an action on resume.
4. Preserve capture text and idempotency. Prove that a Siri capture is visible to the same authenticated owner on the canonical web surface, or explicitly identify the existing inbox as a separate staging ledger with a safe promotion path. Queue success means persisted locally, not synced; test retry without duplication and protect data across sign-out/account changes.
5. Add modern Siri Tool Intents, App Entities and App Skills only after checking Apple's current developer-preview SDK/API availability. Keep ordinary App Shortcuts working on supported OS versions; treat custom Siri tool behavior and distribution as separate release gates. Skills guide tool use; server authorization and evidence enforce the actual constraints. No model keys in iOS.
6. Add native resume route and later connection investigation (existing Project Review / structural transfer semantics). Never make an analogy a confirmed lesson automatically. Owner-confirmed rule preserves original source, scope, conditions, exceptions and future inheritance proof.

## Acceptance gates (real records only; do not mark passed before observing)
- Same authenticated account, same Primary Mission and canonical saved action ID on web and native/Siri; intentional changes to real state reflected on both.
- Saved commitments cannot be silently superseded by predictions. Distinguish clarification, stale/failed read, no mission, and predicted states.
- Signed-out/expired/wrong-account sessions fail closed; no private content or mutations without authorization. Device-lock behavior tested.
- Capture: remotely persisted receipt or explicit durable local pending receipt; failed local write cannot claim success; retry idempotent; visible on canonical surface or explicitly staged.
- Native Xcode build and signed physical iPhone run; record version, commit, target, observation and limitations. SDK-specific Siri Evaluations only when actual supported preview environment exists.
- Later: capture a real source -> investigate against real prior context -> owner confirms transferable rule -> a subsequent real reconstruction changes without restating the rule. Until observed, transfer remains unproven.

## Scope and release safety
This is a reconciliation and initial capture-integrity repair, not a completed Siri AI integration. No production deployment, schema change, main merge, package upgrade, credentials or destructive migration authorized here. Do not disturb active web release. No invented data, placeholder success or fake evidence. Existing historical branches are not assumed to be authoritative. Apple reference: https://bitrig.com/blog/siri-ai-for-developers and https://developer.apple.com/documentation/appintents/ (verify current SDK and APIs before implementation).

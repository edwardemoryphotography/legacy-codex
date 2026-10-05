# Control Panel integration

Eddie selected https://codex-control-panel-two.vercel.app and asked to bring its design, dynamic interactions and task routing into Legacy Codex's Strategic Delta experience. Reference source: `codex-system-architecture/codex-control-panel`, commit `e56c3e2`. Implementation base: `0af100a`.

## Behavior

- Strategic Delta still recommends **what** to do; **Route this move** carries its actual task and mission into the composer without accepting or saving it.
- The composer prepares **how** to do a task: local lane rules, current-tool override, priority and an optional follow-up lane. The leading action has more weight than incidental context keywords.
- Handoffs preserve human intent and recorded mission constraints. Evidence statuses and freshness remain explicit. Failed reads never become empty evidence. A changed task, context, preference or correction invalidates the previous handoff.
- Selecting a provider is a handoff preference, not a connected execution capability. No simulated model calls, execution, progress or confidence percentages.
- **Prepare saved action** lets the person review and explicitly save the task and handoff together in canonical `actions.action_title` / `actions.resume_note`. The existing one-unfinished-action rule and update concurrency guard still apply. Existing actions are never overwritten by routing.
- Explicit routing corrections on a selected saved project append token-only records to the caller’s `mission_events`; account-scoped bounded weights are reconstructed from those records. Browser/session-only fallback is labeled when an account save cannot be confirmed. Unsaved tasks are not persisted. Saved action handoffs travel with the existing Mission account; browser accounts on separate preview hosts are distinct.
- Rounded glass surfaces, spectrum accents, focus glow, preference switches and result reveals follow the chosen Control Panel design. The existing single orb remains driven by real Delta state; motion preferences remain respected. Production remains dark; the existing light theme remains available for local/preview review.
- Composer engagement immediately fills the whole input with flowing amber, coral, blue, violet and pink, including the gradient edge from Eddie's iPhone reference. Motion follows both system and Controls preferences; reduced motion keeps the color static.
- The microphone invokes native `SpeechRecognition` or `webkitSpeechRecognition` only from a human tap. Permission pending, actual listening, stopping and errors remain separate. Interim results append to the preexisting draft within the 2,000-character input limit; manual editing, account/mission changes, routing, leaving the page or unmount cancel capture. Nothing auto-routes or saves.
- The existing single orb reacts to composer engagement and real speech listening through a separate interaction state. Listening never becomes model reasoning or fabricated progress. Browser speech processing may use its provider's remote service; Legacy Codex adds no audio store or model endpoint. Unsupported engines offer keyboard dictation.

## Scope ruling

Ruling: ship local routing and explicitly saved action handoffs using the existing ownership contract. Do not widen Foundry RLS or create a second routing authority. Canonical `routed_requests` currently requires a Foundry workspace and owner-only access, while Mission uses user-scoped private browser identities. Corrections in this slice are a transitional Mission-ledger learning projection, not canonical Foundry routing history or a superseding ownership decision. A later workspace/account link and forward migration belongs in the canonical routing/event stores after its permissions are reviewed.

No new database migration, model endpoint, credential, access key UI or external-tool execution is introduced.

## Verification ledger

- Baseline: 273 tests passed before changes.
- Routing tests first failed on the absent module; the real integration request then exposed continuity keywords incorrectly outweighing “Implement.” The leading-action fix passes.
- First integrated check: 279 tests pass; TypeScript and production build pass; ESLint reports zero errors and eight pre-existing warnings.
- Final suite: 284 tests pass; TypeScript and production build pass; lint zero errors (eight existing warnings). GitHub `verify` passes.
- Vercel preview renders the actual supplied integration request and its prepared handoff. Tool override, clipboard contents, route correction and correction restoration after reload were checked through the UI. No app console errors or framework overlay; unrelated browser-extension metadata errors were observed.
- The preview starts with a real empty private browser workspace. No synthetic mission/action was created to verify database writes. Live saved-action writes with an existing mission and iPhone Safari remain unverified in this slice.
- Voice/color follow-up: 290 tests pass, production build and TypeScript pass. Text boundary tests use Eddie's actual words; no simulated microphone or invented transcript establishes recognition. Real iPhone Safari speech capture still requires device verification.

## Durable lesson

The task router carries a recommendation into a tool handoff; it does not own priorities or create a commitment. Continuation context belongs with the explicit saved action. Never infer provider connectivity from a tool selector, present keyword scores as probability, or silently retarget a Secondary handoff to Primary.

## Goose inheritance follow-up — 2026-10-05

Every primary and follow-up handoff now carries the public cognitive doctrine and complete, scoped human-confirmed rules. `/api/task-routing` reads lessons and account routing corrections using the caller’s JWT/RLS; explicit project corrections append idempotent token-only events. These reads purchase no model call. No history is inferred from a project title. Learning changes, account/project switches and focus refresh invalidate prepared prompts; unavailable reads are named rather than represented as no prior learning.

`analyze`, `brief` and `delta-operation` read applicable saved rules before calling the model. Analysis currently supplies account rules unless an explicit project ID is provided. Brief sends the IDs of its clipped roster and labels each corresponding project in the directive. Operation assistance receives the exact unresolved project ID. Lesson selection pages beyond retired/unrelated records and keeps conditions/provenance intact under context limits.

Local regressions and query-protocol checks do not prove real-account pagination, retirement propagation, cross-device correction restoration or useful model behavior. Those production owner workflows remain unverified. Evidence polling preserves previous observations on repository or per-PR check-source failures with original timestamps and stale status, using an atomic file replacement.

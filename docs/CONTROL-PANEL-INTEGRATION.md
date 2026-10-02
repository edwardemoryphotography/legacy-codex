# Control Panel integration

Eddie selected https://codex-control-panel-two.vercel.app and asked to bring its design, dynamic interactions and task routing into Legacy Codex's Strategic Delta experience. Reference source: `codex-system-architecture/codex-control-panel`, commit `e56c3e2`. Implementation base: `0af100a`.

## Behavior

- Strategic Delta still recommends **what** to do; **Route this move** carries its actual task and mission into the composer without accepting or saving it.
- The composer prepares **how** to do a task: local lane rules, current-tool override, priority and an optional follow-up lane. The leading action has more weight than incidental context keywords.
- Handoffs preserve human intent and recorded mission constraints. Evidence statuses and freshness remain explicit. Failed reads never become empty evidence. A changed task, context, preference or correction invalidates the previous handoff.
- Selecting a provider is a handoff preference, not a connected execution capability. No simulated model calls, execution, progress or confidence percentages.
- **Prepare saved action** lets the person review and explicitly save the task and handoff together in canonical `actions.action_title` / `actions.resume_note`. The existing one-unfinished-action rule and update concurrency guard still apply. Existing actions are never overwritten by routing.
- Browser-local correction weights are bounded, account-scoped and token-only. Unsaved tasks are not persisted. Saved action handoffs travel with the existing Mission account; browser accounts on separate preview hosts are distinct.
- Rounded glass surfaces, spectrum accents, focus glow, preference switches and result reveals follow the chosen Control Panel design. The existing single orb remains driven by real Delta state; motion preferences remain respected. Production remains dark; the existing light theme remains available for local/preview review.
- Composer engagement immediately fills the whole input with flowing amber, coral, blue, violet and pink, including the gradient edge from Eddie's iPhone reference. Motion follows both system and Controls preferences; reduced motion keeps the color static.
- The microphone invokes native `SpeechRecognition` or `webkitSpeechRecognition` only from a human tap. Permission pending, actual listening, stopping and errors remain separate. Interim results append to the preexisting draft within the 2,000-character input limit; manual editing, account/mission changes, routing, leaving the page or unmount cancel capture. Nothing auto-routes or saves.
- The existing single orb reacts to composer engagement and real speech listening through a separate interaction state. Listening never becomes model reasoning or fabricated progress. Browser speech processing may use its provider's remote service; Legacy Codex adds no audio store or model endpoint. Unsupported engines offer keyboard dictation.

## Scope ruling

Ruling: ship local routing and explicitly saved action handoffs using the existing ownership contract. Do not widen Foundry RLS or create a second routing authority. Canonical `routed_requests` currently requires a Foundry workspace and owner-only access, while Mission uses user-scoped private browser identities. Corrections in this slice are honestly browser-local, not canonical cross-device routing history. A later workspace/account link and forward migration belongs in the canonical routing/event stores after its permissions are reviewed.

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

# Action Follow-Through & Mission Clarity Verification (2026-11-02)

## 1. Traced Reality Before Changes

| Control | Previous Behavior | User Friction |
| --- | --- | --- |
| **Accept this move** (`StrategicDelta`) | Recorded `mission_events` (`type: 'delta_accepted'`) and set `shownAcceptance`, which only pre-filled the separate `SavedActions` composer input (`#saved-action-title`) further down the page. | Clicking **Accept this move** did not create a saved commitment in `actions`. The user still had to scroll down, find `Your saved actions`, copy/paste or click `Add draft to starting point`, and click `Save next action`. |
| **Working draft** (`section.mission-work-draft`) | Rendered markdown inside `StrategicDelta` with no direct save or copy control; only offered `Add draft to starting point` inside `ActionCard` after an action was already created. | Required hunting for a second form below to preserve or commit the draft. |
| **Name the evidence** (`name-evidence:` / missing `evidenceRequirement`) | Displayed prose telling the user to name evidence, or showed `Not named yet — add it when you set the finish line` inside `What Codex has from you`. | Required scrolling past Relay, files, and routing to open `Review your Primary mission` (`What will prove it is done` + `Set proof`). When a finish line contained `" and "` (e.g., `"when this is intuitive and easy and beautiful to interact with"`), `decomposeFinishLine` split it into clauses and suppressed `name-evidence:` altogether. |
| **Clear blocker** (`unblock:`) | Displayed prose recommending clearing the blocker in `StrategicDelta`. | Required scrolling down to `Review your Primary mission` to find and click `Clear blocker`. |
| **Promote parked mission** (`promote:`) | Displayed prose recommending promoting the mission in `StrategicDelta`. | Required scrolling down to the Parked section to click `Promote to Primary`. |
| **Prepare saved action** (`TaskRouter`) | Set `routedDraft` state in `MissionTab` to pre-fill the `SavedActions` composer without persisting a row in `actions`. | Did not distinguish preparing a handoff in the form from actually saving the commitment. |
| **Starting Plan** (`buildDeterministicAssistance`) | Echoed `- **From your note:** <full note>` verbatim in the non-writing plan and duplicated `delta.because` below `What Codex has from you`. | Repeated the user’s own note back to them (observed around 1:40–2:20 in `/private/tmp/ScreenRecording_11-02-2026 01-36-44_1.MP4`). |

---

## 2. Implemented Action Controls & Exact Operations

1. **`Save as my next action` / `Replace saved next action`** (`StrategicDelta` & `HomeTab`):
   - **Operation**: Idempotently records `mission_events` (`delta_accepted`) if not already accepted for the current move, then inserts (or updates the existing open `TODO`/`IN_PROGRESS` row in) `actions` (`is_next_action: true`, `status: 'TODO'`) carrying the active project (`mission_id`) and any active working draft (`resume_note`).
   - **Progress & Result**: Shows inline progress (`Saving commitment to <mission>…`) beside the button, then displays a persistent confirmation banner (`Saved as your next action: <title>`) with a direct link (`Return to this saved action`) and an immediate execution transition button (`Start this action now`).
   - **Failure & Retry**: Preserves all project context and drafts on failure, explains what failed, and provides `Retry saving next action` with an in-flight ref guard that prevents duplicate `delta_accepted` or `actions` rows.
2. **`Save move & draft as my next action` & `Copy draft`** (`StrategicDelta` working draft panel):
   - **Operation**: Saves both the recommended move and the structured/model working draft directly into `actions` (`resume_note`) in one click, or copies the draft to the clipboard.
3. **`Start this action now`** (`StrategicDelta` result banner) & **`Start / resume`** (`SavedActions`):
   - **Operation**: Updates the saved commitment row in `actions` from `TODO` to `IN_PROGRESS` (`is_next_action: true`) and updates the live status banner in place (`In progress as your next action`).
4. **`Save draft to starting point`** (`SavedActions` `ActionCard`):
   - **Operation**: Immediately persists the active `StrategicDelta` working draft (or prepared handoff note) into the saved action’s `resume_note` column in `actions` without requiring a two-step paste + `Save note` click.
5. **`Save evidence requirement`** (`StrategicDelta` inline proof box):
   - **Operation**: Calls `setEvidenceRequirement` and persists `evidence_requirement` on `missions` plus `evidence_requirement_set` in `mission_events` directly from `StrategicDelta` whenever the active mission has a finish line but no `evidenceRequirement` yet (supporting `"Me using it right now on my phone"` without hunting through secondary panels).
6. **`Mark blocker resolved & resume Primary`** (`StrategicDelta` inline blocker box):
   - **Operation**: Calls `unblock` and persists `blocker: null` on `missions` plus `unblocked` in `mission_events` directly from `StrategicDelta` when a `clear_blocker` recommendation is active.
7. **`Make “<title>” my Primary mission`** (`StrategicDelta` inline promote box):
   - **Operation**: Calls `promoteToPrimary` and persists `state: 'primary'` on `missions` plus `promoted_primary` in `mission_events` when no Primary mission is active and `StrategicDelta` recommends promoting a ready parked mission.
8. **`Save handoff as my next action` vs. `Prepare saved action`** (`TaskRouter`):
   - **Operation**: Clearly distinguishes preparing a handoff in the composer (`Prepare saved action`) from persisting the handoff directly to `actions` (`Save handoff as my next action`), while explicitly stating that external tools (`Claude`, `Cursor`, `ChatGPT`, `Gemini`, `Perplexity`) are not executed automatically.

---

## 3. Mission Clarity, Progressive Disclosure & Acceptance Checks

- **Adjacent Commitment Flow**: `Your saved actions` (`SavedActions`) is now positioned immediately below `StrategicDelta` so the current project, the next useful action, and its saved result live in one contiguous vertical flow.
- **Secondary Project Creation & Progressive Disclosure**:
  - `Begin a new project` (`Start a new project`) is placed below `Your saved actions` inside `<details class="mission-disclosure"><summary>Start or switch to another project</summary>...</details>` (collapsed while a Primary or Secondary project is active, open when no active project exists).
  - `MissionFiles` is grouped under `<details class="mission-disclosure"><summary>Attach project files for Claude to read</summary>...</details>`.
  - `Parked` and `Capture Idea` are grouped under `<details class="mission-disclosure"><summary>Parked ideas & capture (N)</summary>...</details>`.
  - `LessonRelayReceive` renders in a compact single-Summary disclosure (`data-active="false"`) unless a `?relay=` code, received lessons, or status notice is active.
  - `#codex-menu` in `CodexApp` groups the 5 core surfaces under **Workspace** (`Home`, `Mission`, `Codex`, `Territory`, `Controls`) and the 8 reference/diagnostic surfaces under **Reference & diagnostics**.
- **Observable Acceptance Checks Beneath Broad Finish Lines**:
  - `deriveObservableAcceptanceChecks(mission)` preserves Eddie’s broad finish line (`"when this is intuitive and easy and beautiful to interact with"`) verbatim and adds concrete, observable acceptance checks beneath it in `What Codex has from you`, `Review your Primary mission`, and deterministic starting plans, incorporating his usability proof (`"Me using it right now on my phone"`).
- **Recording Evidence Notes**:
  - **1:40–2:20**: Eliminated verbatim repetition of the raw project note in `buildDeterministicAssistance` non-writing plans and eliminated duplicate `delta.because` rendering below `What Codex has from you`; added visible inline progress (`Reading project context and checking sources…`) beside `Reviewing project…`.
  - **2:25–3:30**: Surfaced proof setting, blocker resolution, action saving, and draft attachment directly on the recommendation card and adjacent `SavedActions` card.
  - **Final seconds (app-switching starfield)**: Treated as unknown cause; no unverified desktop fix is claimed for the iOS app-switcher WebGL/canvas lifecycle behavior.

---

## 4. Verification Evidence

- **Automated Test Suite (`npx vitest run`)**: 59 test files passed, 592 tests passed (including new regression suites in `src/lib/missionAssistance.test.ts`, `src/components/StrategicDelta.test.tsx`, `src/components/tabs/MissionTab.ui.test.tsx`, `src/components/tabs/HomeTab.test.tsx`, and `src/components/TaskRouter.test.tsx`).
- **Typecheck & Lint (`npx tsc --noEmit && npm run lint`)**: 0 TypeScript errors, 0 ESLint errors.
- **Production Build (`npx next build --webpack`)**: Succeeded cleanly.
- **Rendered Browser Verification (Phone `390×844` & Desktop `1440×900`)**:
  - Verified via local Playwright harness over the built Next.js app (explicitly scoped as UI contract & rendered layout verification using stateful route interception so no anonymous users or test rows were fabricated in production Supabase).
  - Exercised: inline `Save evidence requirement` (`"Me using it right now on my phone"`) → `Help me move this forward` → recommendation + observable acceptance checks → simulated failed `Save as my next action` (draft preserved) → `Retry saving next action` → visible result banner + `Your saved actions` card → page reload → resumed state → `Start this action now` (`IN_PROGRESS`).

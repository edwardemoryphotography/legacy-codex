# Legacy Codex Rescue Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Legacy Codex from a polished local dashboard into a more operational private studio OS with deep linking, operator controls, persisted workspace snapshots, codex bookmarking/search improvements, resumable logs, and more useful biometric/task workflows.

**Architecture:** Keep the existing static Next.js app and client-side tab shell. Add a small shared workspace layer for deep-linking and persistence, then upgrade each tab with a focused feature that improves operator utility without introducing a server dependency. Favor localStorage-backed state, explicit export/import actions, and real-data verification where already supported by the repo.

**Tech Stack:** Next.js 14.2.5, React 18, TypeScript, localStorage, static deploy.

---

### Task 1: Add workspace deep-linking and command palette

**Objective:** Make the app feel like a real operator surface with tab deep links, keyboard shortcuts, and quick actions.

**Files:**
- Modify: `src/components/CodexApp.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Write the UI and state plumbing**
- Read `?tab=` or `#tab=` from the URL on load
- Sync active tab changes back into the URL
- Add a command palette / quick switch modal with tab search
- Add keyboard shortcut support (`Cmd/Ctrl+K`, `/`)
- Add a compact top-bar action area for copy/export/resume shortcuts

**Step 2: Verify**
- Run `npm run build`
- Confirm no hydration or type errors
- Open the app and verify the palette opens and tab switching works

### Task 2: Make resumption and workspace state persistent

**Objective:** Capture the last useful state so the app can be resumed cleanly after interruption.

**Files:**
- Modify: `src/components/tabs/ResumptionLogTab.tsx`
- Modify: `src/components/tabs/OverviewTab.tsx`
- Modify: `src/components/tabs/ProtocolsTab.tsx`
- Modify: `src/components/ui.tsx` if needed for consistent controls

**Step 1: Persist history and snapshots**
- Store a local history of generated resumption packets
- Add a copy/share action for the latest packet
- Add a compact workspace snapshot export with the active tab and important local state summaries

**Step 2: Verify**
- Generate a packet, refresh the page, and confirm history survives
- Build passes without introducing client/server mismatches

### Task 3: Upgrade Codex browsing into a usable knowledge graph

**Objective:** Improve search, bookmarks, and entry-level navigation so the Codex behaves like a real knowledge tool.

**Files:**
- Modify: `src/components/tabs/CodexTab.tsx`
- Modify: `src/data/codex.ts` if indexing helpers are needed
- Modify: `src/components/ui.tsx` if reusable chips/buttons are needed

**Step 1: Add usability features**
- Add bookmark/pin support for entries via localStorage
- Add recent entries and quick jump controls
- Add tag-based filtering or section stats
- Add copy-link / copy-markdown utilities for the selected entry

**Step 2: Verify**
- Search, open, pin, and reopen entries
- Build passes and the UI remains static-host friendly

### Task 4: Make sprint and constraint workflows more action-oriented

**Objective:** Turn vague inputs into sharper artifacts and tighter validation.

**Files:**
- Modify: `src/components/tabs/SprintLinkerTab.tsx`
- Modify: `src/components/tabs/ConstraintValidatorTab.tsx`

**Step 1: Expand workflow outputs**
- Sprint Linker: generate a checklist / markdown plan from the input
- Constraint Validator: improve file-analysis guidance and failure states
- Keep the existing no-mock, no-fake-data posture

**Step 2: Verify**
- Exercise both flows manually
- Confirm build/type checks still pass

### Task 5: Harden biometric/operator polish

**Objective:** Make biometric and shell-polish components more operational and less demo-like.

**Files:**
- Modify: `src/components/tabs/BiometricsTab.tsx`
- Modify: `src/components/CodexApp.tsx` if needed for summary badges

**Step 1: Add operator-facing refinements**
- Add explicit refresh status / last loaded state
- Add clearer live-data guidance and a stronger empty state
- Add a summary badge or quick status signal in the shell if useful

**Step 2: Verify**
- Load with and without `public/notes/biometric-trends.json`
- Confirm the unavailable state stays honest

### Task 6: Final verification and cleanup

**Objective:** Confirm the rescued app is shippable and maintainable.

**Files:**
- All touched files

**Step 1: Run verification**
- `npm run build`
- Manual browser smoke test of the changed tabs

**Step 2: Final cleanup**
- Remove dead code and fix any warnings surfaced during build
- Commit once the app is verified

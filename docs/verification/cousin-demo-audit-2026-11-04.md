# Cousin-ready demo audit — 2026-11-04

Canonical: https://legacy-codex.vercel.app
Audit revision: `6b3bc7e` (production before this milestone)
Environment: fresh Chrome profile, 390×844 and 390×664, then 430×739 and desktop.
The browser received a non-owner anonymous account. No owner data or model
response was available. No production missions, actions, evidence or lessons
were created for this audit.

## What a first-time non-owner sees

1. **Home is honest about access but not focused.** It showed “View only · sign
   in for AI”, a full disabled chat shell, live voice disabled, model selectors,
   Missions/History, and a sign-in link. The screen looked like a chat that did
   not work until the user read several lines.
2. **403 responses appear in the browser console** when the account probes AI
   access. Nothing in the visual UI claims a model ran.
3. **Sign-in is direct** and preserves a typed draft. This was verified against
   production: the action opens Controls in the existing-account email flow, and
   returning Home retains the draft.
4. **A guest cannot use AI.** The owner gate is intentional and working. This is
   the main demo constraint, not a bug to bypass.
5. **Mission conversation is collapsed** behind “Continue conversation with
   Codex”; the Mission workflow begins at y=126 on desktop.
6. **Controls is clean of sample readings and internal account IDs**; Opaque
   surfaces is present.
7. **Phone layout** at 390×664/844 keeps greeting, Missions/History and composer
   visible with no horizontal overflow after the glass repair.
8. **No real owner mission was available**, so mission creation, save,
   completion, reload/reauth and lesson/connection presentation remain
   unverified in this audit.

## Ranked demo blockers

**P0 — owner-session availability**
The external evaluator’s fresh browser is not the owner; AI is disabled by
design. A demo must use Eddie’s owner session. Do not widen AI access or hand a
guest account a fake model response.

**P1 — disabled-chat first impression (repaired here)**
For a non-owner the screen now shows one primary **Sign in to your existing
account** action instead of an apparently usable composer. The disabled chat
shell is removed from the non-owner view.

**P1 — owner mission/resume path not runtime-verified**
Create/resume, save, completion, reload and reauthentication were not exercised
against a real owner account. This must be checked before an external demo.

**P2 — live voice is owner-only and microphone permissions were not exercised**
The transport and UI are tested, but the real start/listen/answer/stop path is
unverified in this session.

**P2 — cross-project connection and lesson display require real evidence**
Territory and Mission show these only when real records exist. Do not manufacture
a connection; if none exists, say so in the demo.

**P3 — menu has 13 destinations**
Appearance is now first and the menu is scrollable, but a first-time viewer may
still see more than the demo needs. Do not remove screens; guide the viewer to
Home, Mission and one result.

## Minimal implementation

- Replace the non-owner chat shell with one explicit access gate.
- Keep the owner composer, saved action and live voice unchanged.
- Keep Mission collapsed until the viewer asks for conversation.
- Keep real data/provenance labels; add no demo fixtures.
- Provide a preflight and a five-minute demo script (see demo guide).

## Verification still required before GO

- Sign in on the demo device as the owner; confirm no access gate.
- Open a real mission; confirm objective, finish line, current saved action and
  evidence are present.
- Ask one real question and show the provider/tier label.
- Save the proposed action; refresh; confirm the same action ID/note.
- Optionally exercise live voice and microphone permissions.
- Show a confirmed lesson/connection only if the data exists.

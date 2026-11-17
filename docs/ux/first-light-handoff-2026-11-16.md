# Operation First Light — UX audit, Home redesign and handoff

**Date:** 2026-11-16 (Pacific) · **Branch:** `claude/legacy-codex-ux-first-light-wtnb7e` · **PR:** [#197](https://github.com/edwardemoryphotography/legacy-codex/pull/197) (draft) · **Base:** `main` at `9f59a09`

This is the record a later builder (GPT-6 Astra or anyone else) needs to continue without repeating the audit. It separates what was observed in a real browser from what was read in source and from what was only simulated.

Evidence labels used below: **[OBSERVED]** seen in a real browser; **[SOURCE]** read in code, not rendered with real data; **[SIMULATED]** rendered locally from labelled fixture rows; **[NOT VERIFIED]** not checked.

## 1. What the product looked like before

### First-time visitor, production, real browser [OBSERVED]

Captured from `https://legacy-codex.vercel.app` as a real anonymous guest at 375×667, 390×664, 390×844, 430×739 and 1440×900 (Chromium, 2026-11-16 ~14:00 Pacific). Production was serving `374a15d`; `main` differs from it only by a docs commit.

| Finding | Evidence | Severity |
| --- | --- | --- |
| Home's entire content was “This browser account cannot use AI yet. Sign in to the account that owns these missions.” Nothing said what the product is or what to do. | `first-light-2026-11-16/before-prod-guest-home-390x844.png` | High |
| That copy presumes missions already exist. A new visitor has none. | same | High |
| The one thing a visitor *can* do (name what matters in Mission, saved privately, no AI needed) was behind a chip labelled “Open project workspace”. | `before-prod-guest-mission-390x844.png` shows Mission working for a guest | High |
| On a 1440px screen Home sat left of centre: the content column was 598px wide and pinned to the left edge of a 1072px row. | `before-prod-guest-home-1440x900.png`; measured `#home-conversation` left 184, width 598 | Medium |
| No horizontal overflow at any size. | measured `scrollWidth − clientWidth = 0` | — (good) |
| Mission, as a guest, opens on “Your next move → Name what matters” with a clear form. | `before-prod-guest-mission-390x844.png` | — (good, preserved) |

### Returning owner [SOURCE] — the owner session could not be opened

No authenticated owner browser was available, so the owner's Home was read in `src/components/tabs/HomeTab.tsx` at `9f59a09`, not seen.

- Home opened on an orb, “Hi Eddie — What would you like to work through?”, and a composer. The Primary mission appeared only as a small “Working on: …” line.
- The saved next action was not on Home. It was inside a dialog opened by a chip labelled “Missions”, which then offered “Continue in Mission”. Reaching a saved action took two taps, and the first one did not say it led there.
- The saved action surfaced on Home only *after* a model reply existed.
- Three names were used for one place: “Open project workspace”, “Mission”, and “Missions”.

### What the prior critique got right, and where it was off

| Hypothesis from the brief | Verdict |
| --- | --- |
| Home emphasizes conversation more than continuation | **Confirmed** [SOURCE]. |
| Actual next actions insufficiently prominent | **Confirmed** [SOURCE]: hidden in a dialog. |
| Home and Mission feel disconnected | **Partly.** They already share one data source, one draft and one conversation. The disconnect was naming and the hidden path, not architecture. |
| Important responses hidden behind extra interactions | **True but deliberate.** Home shows an excerpt plus “Read full answer”. Left unchanged; see Remaining work. |
| Lesson influence hard to discover | **Confirmed, with a hard limit.** Production has zero confirmed lessons (`PROJECT_STATUS.md`, Nov 16 read-only count), so there is no real influence to show yet. |
| Technical language adds overhead | **Mostly in Mission**, not Home. Mission still says “Recommendation / A prediction, not a commitment”, “Route this move”, “Something changed”. |
| Too many navigation destinations | **Not the bottleneck.** The menu's 13 screens are already grouped and the secondary ones are visually quieter. Not changed. |

The critique missed the largest problem: for anyone who is not the owner, Home was an account wall.

## 2. What changed and why

One idea: **Home answers three questions before anything is typed — what matters, what is next, and why.**

### The Continue card (`src/components/HomeContinue.tsx`, `src/lib/homeContinue.ts`)

A projection over rows Home already read (`useMissionTerritory`, `deriveNextAction`, `latestAcceptance`). No new store, no new query, no model call, no write.

- **What matters:** the saved Primary mission title.
- **What is next:** the saved step, or the accepted suggestion, with its status in words:
  - `Saved next step · not started` / `In progress` — accent colour, because the person committed to it.
  - `Suggestion you accepted · not saved yet` — neutral colour, and the button says “Review and save this step”, so it cannot read as a commitment.
  - No step: “No next step is saved for this mission yet.”
  - A saved blocker is shown in the person's own words.
- **One button** into Mission, where the saved action already sits at the top with “Start this action now”.
- **What Codex has from you** (first labelled “Why this?”; renamed after review, see section 10). A native `<details>` listing only values that exist: finish line, why it matters, return note (clipped at 280 characters), where the step came from, corrections made on this mission, and confirmed lessons.

Reasoning behind the wording rules, which are tested in `src/lib/homeContinue.test.ts`:

1. *A suggestion is not a commitment; a commitment is not finished work.* The card never says completed, verified or finished. A saved step's provenance line ends “Codex has not checked whether it is done.”
2. *A failed read is unknown, not empty.* If missions or actions fail to load, the card says the saved work could not be read. It never falls back to “no next step” or a first-run invitation. A failed history read does not hide a mission and saved step that loaded; without a saved step the card says the accepted-suggestion check failed.
3. *A lesson's filing mission is not its source* (the PR #192–#195 repair). Lessons are counted across the account only. No mission title is ever attached to a lesson on Home. Corrections *are* tied to their mission, because a correction is made on a mission.
4. *Context supplied is not transfer demonstrated.* The lesson line reads “available to Codex as context when you ask or review, within the scope you set. That is context supplied, not proof it changed an answer.” With zero lessons it says “None yet. A lesson appears here after you confirm one in Mission.”

### First visit and accounts without AI

Mission data never depended on AI access, so the card now shows for every account. The AI notice moved under it as a small note. An empty account sees “Legacy Codex · start here — Name the one thing that matters” with one button. The Mission-variant gate is unchanged.

### Less chrome

- The “Missions” chip and its dialog are gone; their content is the card.
- “Open project workspace” is now “Open Mission”, shown only when the card is not already offering a button to Mission (while loading, or when a reply has replaced the card).
- “History” is hidden for an account that has no AI and no history.

### Mission: a saved action leads (added in a second pass, same day)

With a saved action that differs from the current suggestion, Mission used to stack both: the saved action, then the alternative with its form and about ten controls, then the saved-action panel far below. Now the saved action and “Start this action now” lead, and the alternative, project review and corrections sit behind one control, “See other options”. Nothing was removed and no state or handler changed: `StrategicDelta.tsx` adds one boolean and one button, and one CSS rule hides the siblings that follow the existing “Also consider” marker. It stays open on its own whenever the person has already engaged with the alternative (an acceptance, a draft, a project review, a pending replace, an open panel).

Measured at 390px wide [SIMULATED layout]: the page went from 4,209px to 2,987px tall and the saved-action panel moved from 2,126px to 904px from the top. Expanding restores the full 4,209px. `layout-fixture-mission-collapsed-full-390.png`.

### Defects fixed along the way (all found in the browser)

| Defect | Cause | Fix |
| --- | --- | --- |
| Home left of centre on wide screens | `#home-conversation` was added as a wrapper but the old `#panel-home` flex rule was never moved to it | `src/app/immersive.css` |
| Orb drawn over the content under it on phones | A Mission rule gave the hero orb `min-height: 124px` on screens ≤600px; on Home the orb's slot can be smaller | `src/app/immersive.css`, scoped to Home |
| Orb would not follow its slot when saved rows arrived | The persistent orb re-measures only on resize; centred content moves without resizing | Pin the orb to the top of the stage when the card is present (`HomeTab.module.css`). `OrbHost.tsx` not touched |
| “Voice ended when the app went to the background” after merely switching apps | The visibility/pagehide handlers called `stop()` even when no session was open | Guard in `src/components/CodexLiveVoice.tsx` |

## 3. What was deliberately left alone

- **No API route, auth rule, owner gate, schema, migration or environment variable changed.**
- **No lesson, provenance, review or Relay logic changed.** `lessonProvenance.ts`, `projectReview*`, `/api/delta-lessons` and `/api/delta-review` are untouched.
- **`MissionTab.tsx` is untouched.** `StrategicDelta.tsx` gained only the fold described above; its prediction, acceptance, save, replace, correction and review logic are unchanged.
- **`OrbHost.tsx`, the orb renderer and its state mapping are untouched.** The orb still reflects real state only; on Home it is smaller at rest when the card is present.
- **The reply view, the composer, voice, tiers and the tools sheet are unchanged**, apart from the false “ended” status.
- **The menu is unchanged.**

## 4. Files

| File | Change |
| --- | --- |
| `src/lib/homeContinue.ts` | New. Pure view-model and `activeLessonCount`. |
| `src/lib/homeContinue.test.ts` | New. 12 tests on wording and precedence. |
| `src/components/HomeContinue.tsx`, `.module.css` | New. The card. Uses `--g-*` tokens, so light mode and palettes follow. |
| `src/components/tabs/HomeTab.tsx` | Renders the card; removes the Missions dialog; compact account note. |
| `src/components/tabs/HomeTab.module.css` | Card layout on the stage; compact gate. |
| `src/components/tabs/HomeTab.test.tsx` | Four tests ported from the dialog to the card; seven new card tests. |
| `src/app/immersive.css` | Desktop centring; Home orb floor. |
| `src/components/CodexLiveVoice.tsx` | Open-session guard on lifecycle handlers. |
| `src/components/StrategicDelta.tsx`, `.test.tsx`, `src/app/mission-assistance.css` | Fold the alternative behind “See other options” when a saved action leads; two tests. |
| `AGENTS.md`, `STATE.md` | Home section and repo-local note. |

## 5. Verification

Run on the branch after the last source change (the review fixes in section 10):

| Command | Result |
| --- | --- |
| `npm run check:builder` | 3 authentic incident excerpts rejected (pass) |
| `npm run check:immersive` | 6 pass, 0 fail |
| `node --experimental-strip-types --test scripts/check-economy.mjs` | 3 pass, 0 fail |
| `npm run lint` | 0 errors, 22 warnings (same 22 as `main`) |
| `npx tsc --noEmit` | clean |
| `npm test -- --run` | 73 files: 72 passed, 1 skipped; 699 tests passed, 2 skipped (`main`: 672) |
| `npm run build` | success |

Browser, real, no fixtures [OBSERVED]:

- Production before-state at five sizes (above).
- The branch's **production build served locally** (`npm run build && npm start`), talking to the real Supabase project as a real anonymous guest, at the same five sizes plus light mode at 390×844: new first-run Home renders, no horizontal overflow, “Name what matters” opens the working Mission form. Screenshots: `after-local-guest-home-*.png`.

Browser, simulated layout only [SIMULATED]:

- `layout-fixture.js.txt` intercepts the browser's own reads on the local server and answers with rows whose titles say `LAYOUT FIXTURE`. Nothing is written anywhere. 21 scenes (owner saved / in progress + blocker + Why open / no step / guest with a mission × five sizes, plus light): 0 horizontal overflow in all 21; the main button visible in all 21; no scrolling needed in any closed-card scene; orb box equals its slot box. Raw numbers: `layout-fixture-measurements.txt`.
- This establishes layout. It is **not** evidence about Eddie's data, the owner session, or model behaviour. The repo has used the same method before (`STATE.md`, 2026-10-27 email sign-in).

**[NOT VERIFIED]**

- The owner's real Home and Mission with real missions and a real saved action.
- Any model output, voice, live voice, Brief, Triage or review.
- A physical iPhone: keyboard, safe areas, Safari toolbar. The card is hidden by the existing keyboard rule (`data-home-keyboard`), which was not exercised on a device.
- Reduced-motion and reduced-transparency rendering (CSS rules exist for the card; not screenshotted).
- The “Voice ended” fix in a browser. It is a guard on existing handlers, covered by type-check only.
- Whether a first-time person understands the product in 30 seconds. No person was tested.
- Deployment. Nothing was merged or deployed.

## 6. Remaining risks

1. **Owner layout is simulated.** A real mission title, a very long step, or an unusual combination of states may lay out differently. First thing to check on a real device.
2. **Dock height on short phones.** With the card closed, everything fits at 375×667. Opening “Why this?” scrolls inside the stage, by design.
3. **`.env.local.example` lists a `SUPABASE_PUBLISHABLE_KEY` that Supabase rejects as “Unregistered API key”.** A local run with that value shows “could not open a session”. Not changed here (deployment docs); a local browser run needs the project's current public key in `.env.local`.
4. **Real guests create anonymous accounts.** The audits visited production and the local build as ordinary guests, which creates anonymous auth users the way any visitor does. No missions, actions, lessons or events were created.
5. **Concurrent work.** No open PR touched these files at 14:00 Pacific on 2026-11-16. Re-check before merging.

## 7. Next recommendations, in order

1. **Owner check on the real device (15 minutes).** Open the PR's Vercel preview signed in: is the mission right, is the step right, does one tap reach “Start this action now”? Everything else waits on this.
2. **Mission density, remaining part.** The alternative suggestion now folds away when a saved action leads (above). Still long: the saved action appears twice (the lead box and the “The action you can return to” panel), followed by Relay, files and five disclosures. Merging the lead box and the panel into one would remove the duplication; it touches `MissionTab.tsx` and `SavedActions.tsx`. Also, Project Review now sits behind “See other options” in that state; if reviews matter more than that placement suggests, lift the Review control next to the saved action.
3. **Plain words in Mission.** “Recommendation / A prediction, not a commitment” → “Suggestion”. “Route this move” → “Hand this to another tool”. Keep the underlying states.
4. **Show a real lesson at work, once one exists.** When `/api/brief` or a review actually receives a confirmed lesson, return which lesson ids were supplied and list them under the answer as “Context supplied: …”. That is the honest version of “it remembered”. It needs a route change and a real confirmed lesson; do not build it against fixtures.
5. **Full answer on Home.** Consider showing the whole answer inline on wide screens, where there is room, and keeping the excerpt on phones.
6. **Guests on Mission.** “Continue conversation with Codex” opens only the account note for an account without AI. Hide it there.

## 8. Recovery

```bash
git clone https://github.com/edwardemoryphotography/legacy-codex
cd legacy-codex
git fetch origin claude/legacy-codex-ux-first-light-wtnb7e
git checkout claude/legacy-codex-ux-first-light-wtnb7e
npm ci
npm run check:builder && npm run check:immersive
node --experimental-strip-types --test scripts/check-economy.mjs
npm run lint && npx tsc --noEmit && npm test -- --run && npm run build
```

- **PR:** https://github.com/edwardemoryphotography/legacy-codex/pull/197 — draft. The head commit and CI result are on the PR page; this file does not repeat a SHA that a later push would make stale.
- **Worktree:** none to recover. The work was done in an ephemeral cloud container; everything is on the branch.
- **To re-run the browser checks:** copy `first-light-2026-11-16/guest-audit.js.txt` and `layout-fixture.js.txt` to `.js` files outside the repo (ESLint's config rejects stray `.js`/`.cjs` under `docs/`), with Playwright available, then `node guest-audit.js <url> <outDir> <prefix>` and `node layout-fixture.js http://localhost:<port> <outDir>`.
- **Known blockers:** no authenticated owner browser; zero confirmed lessons in production.
- **Safe next step:** recommendation 1. Do not merge before it.

## 9. The question

*If someone met Legacy Codex for the first time today, would they understand its purpose, identify what matters, and know how to continue?*

On production today: **no** [OBSERVED]. They would see an account wall.

On this branch: they are told in one sentence what it keeps for them and given one button, which opens a working form [OBSERVED, local build, real guest session]. Whether that is *understood* by a person has not been tested. A returning owner should see their mission and saved step first and reach it in two taps [SIMULATED layout, tested wording]; that needs Eddie's eyes on the real thing before anyone calls it done.

## 10. Independent review, and what changed because of it

An independent review of PR #197 recommended **HOLD** until the owner's real Home and Mission are checked. That recommendation stands. Its findings, each checked against the code:

| Finding | Verdict | Outcome |
| --- | --- | --- |
| The real owner experience is untested | Correct | Unchanged. Only the owner can do this. |
| A history-read failure hid a mission and saved step that had loaded | Correct. The card took its read state from all three reads, though the history only adds an accepted suggestion, which a saved step outranks | Fixed. The card now depends on the mission and action reads. With a saved step it shows at once, even while the history is pending or failed. Without one, a failed history read says “No saved step was found. Whether you accepted a suggestion could not be checked.” |
| “Why this?” is not an explanation of a recommendation | Correct. It lists saved context; it does not say what caused a suggestion | Renamed to “What Codex has from you”, the label Mission already uses for the same kind of list. The causal account stays in Mission's “Why this?”. Bringing it to Home would mean running the suggestion engine there; not done. |
| Lesson copy named only Project Review | Correct. Incident, historical and Relay confirmations also exist, all on Mission | Copy now says “after you confirm one in Mission”. Relay-saved lessons use the same record type, so the count already included them. |
| The Mission fold hides several controls with one CSS rule | Partly. Two real gaps: the toggle unmounted on click, dropping keyboard focus; and a persist error rendered inside the folded region | Fixed. One toggle stays mounted (“See other options” / “Hide other options”, `aria-expanded`), and any persist error forces the region open. Folded controls are `display: none`, so they leave the tab order and the accessibility tree together. |
| Home loses its focus after a response | Not changed. In the reply state Home still shows “Working on: <mission>” and the saved-first line with a link to Mission, both tested. Keeping the full card beside an answer does not fit a phone screen | Open for the owner's judgement after using it. |
| Layout fixtures are not real data | Correct, and already labelled as such | No further fixture runs were made for these fixes; they are covered by unit tests only. The fixture screenshots and script remain in `first-light-2026-11-16/`, named `layout-fixture-*`. Remove them if the repository should hold no simulated captures at all. |

Not re-verified in a browser after these fixes: the Mission toggle and the new card states. They need a saved action, which exists only in the owner's account.

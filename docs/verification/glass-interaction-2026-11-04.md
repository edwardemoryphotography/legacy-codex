# Clear Liquid Glass + interaction repair — 2026-11-04

**Release:** PR #176 merged at `4fed699`; canonical `dpl_5JnWSEPyuvGc8Xo5onqzcFy71PQz` is Ready.

## Scope

This pass repaired the existing Home, Mission conversation, account access,
live-voice handoff, Controls and biometric surfaces. It did not add a new app,
navigation model, native wrapper, action system or sample data.

## Before → after evidence

- **Home at 390 × 664:** before, the greeting and Missions/History were clipped
  below the dock. After, both are visible; the document width equals the
  viewport width (390 = 390), and the greeting ends at 427 while the dock starts
  at 432. See `docs/design-shots/glass-2026-11-04/`.
- **Home at 390 × 844:** greeting 465–537, links 144–188, dock starts 556.
- **Home at 430 × 739:** greeting 377–449, links 116–160, dock starts 507.
- **Long draft:** the composer grows to a bounded 120 px with internal scroll;
  the orb is hidden while the draft is expanded, keeping the greeting and
  shortcuts visible. A 4× repeated prompt produced no horizontal overflow.
- **Mission:** the conversation is collapsed behind **Continue conversation with
  Codex**. The Mission workflow begins at y=126 instead of y=444 on a 1280×900
  desktop, while the same mounted conversation preserves a pending reply when
  reopened.
- **Account:** the Home orb says “Checking access” or “View only · sign in for AI”
  until the owner gate resolves. The sign-in action opens Controls directly in
  the existing-account email flow, and a typed draft survives the trip back.
- **Menu:** Appearance is first, before the workspace/reference lists.
- **Biometrics:** production `biometric-trends.json` is now `[]`; Controls shows
  “No live data — using manual” and no readiness/recovery/focus numbers.
- **Voice handoff:** the live-answer panel separates You/Codex turns, shows the
  full answer with a sticky proposed action and Save control, and a structured
  `NEXT ACTION:` line is saved as the action title instead of an answer excerpt.

## Glass and accessibility

`src/app/clear-glass.css` loads after the existing layers. It gives surfaces a
transparent centre, strong rim/edge thickness, restrained reflection and depth
shadows with a 7px scene blur; menus use a denser functional layer for
readability. It includes:

- `prefers-reduced-transparency: reduce` → solid `--g-ink`, no backdrop filter.
- `prefers-contrast: more` → near-solid dark surface and white border.
- `prefers-reduced-motion: reduce` → no transitions.
- Explicit **Opaque surfaces** preference (`data-glass-opaque`), applied from
  storage on app boot as well as from Controls.

Computed browser checks:

- normal chip background `rgba(7,9,22,.13)`, border `rgba(255,255,255,.47)`.
- opaque and reduced-transparency backgrounds `rgb(13,15,34)`.
- contrast-more background `rgba(5,7,18,.92)`, border `rgba(255,255,255,.92)`.
- reduced-motion animation name `none`.

## Verification run

- `npx vitest run`: 635/635 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: 0 errors (warnings only).
- `npm run build`: passed.
- Browser: local production build at 390×664, 390×844, 430×739, 1280×900;
  menu, long draft, light/sunset appearance, sign-in routing, draft preservation,
  opaque/reduced-transparency/contrast/motion media checks.
- Mobile emulation is Chrome, not iPhone Safari. Actual owner GPT-Live audio and
  a real model response were not exercised in this local anonymous session.

## Production runtime (canonical)

Checked against `https://legacy-codex.vercel.app` at the canonical deployment:

- **390 × 664:** greeting 355–411, Missions/History 144–188, dock starts 436;
  scroll width 390 = client width 390.
- **390 × 844:** greeting 455–511, links 144–188, dock starts 560.
- **430 × 739:** greeting 363–419, links 116–160, dock starts 511.
- The account gate resolved to **View only · sign in for AI**; Send/live voice
  were not presented as owner-ready.
- **Direct sign-in:** clicking the sign-in action opened Controls in the
  existing-account email flow; the production draft survived the trip back.
- **Controls:** no readiness number, sample label, June 2026 date, account ID,
  or visible Supabase/RLS terminology; Opaque surfaces is present.
- **Mission:** conversation hidden; workflow panel starts at y=126 with
  “Continue conversation with Codex”.
- **Live voice** and a real owner model response were not exercised because the
  runtime browser account is not the owner. No production records were created.

## Boundaries

- No production mission, action, biometric or conversation records were created.
- The live-voice save path is covered by parser, API-directive and Home-save
  tests; it still needs an owner-session runtime walk with real microphone and
  model access.
- Voice cost text is visible at taller heights; on short screens (≤760 px) it is
  carried by the start control’s title/aria description and the active-session
  status, so the goal and composer fit.

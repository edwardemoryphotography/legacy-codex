# Home: keep the orb central and the full answer optional

Eddie's November 2 voice review identified the actual failure: a long triage
answer shrank the Codex Glass orb and dominated the phone. The approved direction
keeps that existing orb, a short takeaway beneath it, the composer in reach, and
the full answer in an optional panel. The generated reference supplied layout
inspiration only; its navigation, replacement orb and invented content are not
product requirements.

## Implemented boundary

HomeTab and its scoped CSS own the composition. The orb renderer, global styles,
API routes, authentication, mission/action persistence, provider selection and
HomeSession account/draft ownership are unchanged. The takeaway is a bounded
excerpt of the actual answer, explicitly labeled Excerpt, not a second model
call. The complete original text remains in a native dialog. History and Missions
use that same optional detail surface. Native dialog focus containment, Escape
and return focus preserve keyboard access.

## Verification before release

- 554 existing tests passed; three added corpus/excerpt checks passed.
- TypeScript and builder/immersive checks passed; lint: zero errors, 13 warnings.
- Browser measured no horizontal overflow at 320×568, 390×664, 430×739, and
  compact 390×340. Composer bottoms: 556, 652, 727 and 328 respectively.
- Full-answer scrolling retained all 3,425 characters of the existing canonical
  Cookbook entry used as a layout input. This was not fabricated provider output
  and did not establish the authenticated AI path. The temporary local layout
  route was removed before the release build.
- At 1440×900, details open on the right. On phones they open in a bounded sheet
  with a persistent close control. Escape closed the sheet and returned focus to
  Read full answer. No mission/action/account records were created for these checks.

Local compilation reused an existing Next 16.3.0 dependency installation after a
new install exhausted disk space. Only the partial installation created for this
worktree was removed. Hosted clean-install CI remains the release gate.

## Remaining evidence boundary

Production follow-up: a failed or pending mission read must also remain explicit
inside the Missions sheet, where the composer status is behind the modal. The
sheet repeats that actual read status and offers Open Mission without claiming
the account is empty or creating any records. Two regression checks cover it.

Deployment readiness and production UI must be checked against this release's
commit. A working layout, local error state or passing tests does not prove a new
owner model response, physical iPhone speech input, or on-device keyboard behavior.

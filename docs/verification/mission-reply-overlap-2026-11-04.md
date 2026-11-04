# Mission reply overlap repair — 2026-11-04

## Observed failure

On iPhone, opening the Mission conversation and tapping Triage produced a reply
whose excerpt, **Read full answer** control, live-audio copy, model controls and
composer painted over one another. The conversation card visibly contained two
overlapping layers of text.

The user-provided before image is:
`docs/design-shots/mission-reply-2026-11-04/before-iphone-triage-overlap.webp`.

## Cause

At 390px the reply state matched the more specific
`.home:global(.glass-home[data-reply="true"]) .glass-hero { flex: 1 1 0 }`
rule, which collapsed the Mission conversation hero to **0px height** while its
contents remained `overflow: visible`. The dock therefore painted over the
answer. The same flex/grid interaction also let the answer shrink to 0px in the
Home reply state.

## Repair

- Mission reply hero is now `flex: 0 0 auto; height: auto; min-height: auto`.
- The reply takeaway is a column flex container, not a grid, and the answer is a
  block with a bounded `max-height`; it cannot collapse to 0px.
- On phones, the orb yields to the answer when a reply is present, so the
  answer and **Read full answer** control have room.
- Mission answer remains bounded to two lines; Home remains bounded to three,
  with the full answer still available through **Read full answer**.

## After measurements (390 × 844, fake local reply state)

- conversation card: 126–693px
- answer: 270–314px
- Read full answer: 322–366px
- dock: 374–676px; no overlap
- document width 390 = client width 390

Home reply at 390 × 664: answer 260–334, Read full answer 346–390, dock starts
436; no overlap. Home reply at 390 × 844: answer 322–396, Read full answer
408–452, dock starts 560; no overlap.

## Checks

- 635 Vitest tests passed.
- `tsc --noEmit` passed.
- lint 0 errors.
- production build passed.

The before/after screenshots are in
`docs/design-shots/mission-reply-2026-11-04/`.

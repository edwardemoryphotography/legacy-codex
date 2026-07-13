# Legacy Codex — Redesign Artifact

A beautiful, self-contained redesign of the Legacy Codex front end, built with the
`ui-ux-pro-max` design-intelligence skill.

> This is a **new, standalone artifact** at `redesign/index.html`. It does **not**
> touch the root `index.html` (FREEZE SPEC).

## Open it

Just open `redesign/index.html` in any browser — no build step, no dependencies
beyond Google Fonts. Works offline (fonts degrade gracefully to system mono/sans).

## Design system (intelligence-backed)

| Decision | Choice | Source |
|----------|--------|--------|
| Style | Dark Mode (OLED), calm restraint | `--domain style` → WCAG AAA |
| Typography | JetBrains Mono + IBM Plex Sans ("Developer Mono") | `--domain typography` |
| Accent | Teal (calm) + Amber (action/blocker) | design-system generator |
| Motion | 150–300ms, loaders only, `prefers-reduced-motion` honored | `--domain ux` |

## What's inside

- **Working capture router** — implements the Fast If/Then rules from
  `DELEGATION_RULES_v1.md` client-side. Type a capture, get Route / Why / Next
  Action / Destination. Try the example chips.
- **Five lanes** bento grid (A–E) with keywords and destinations.
- **Single shipping blocker** focus card (mirrors `SHIPPING_BLOCKER.txt`).
- **Four agents** row (routeOmega, triage, distiller, taskRanker).
- **Biometric task re-ranker** — drag WHOOP recovery + Muse focus to watch the
  day's tasks re-order (deep work rises when energy is high; light work when low).
- **Dark/light theme toggle**, full responsive layout, scroll-reveal, keyboard
  focus states.

## Validated

Rendered headlessly (Puppeteer/Chrome) at 1440px and 390px in both themes:
router classification verified, zero console errors.

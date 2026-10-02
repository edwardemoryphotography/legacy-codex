@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) specifically. `AGENTS.md` (imported above) is canonical for this repo's architecture, authority model, RULES, and commands — every agent including Claude Code follows it. This file only adds what's Claude-specific; it does not re-describe the app.

## Claude-specific notes

- This repo talks to Claude directly from two routes: `/api/analyze` (`src/app/api/analyze/route.ts`) for file-based artifact analysis, and `/api/brief` (`src/app/api/brief/route.ts`) for the Brief tab's Daily Brief / Triage / Ask-a-question features over real mission rows — both via `@anthropic-ai/sdk`. See AGENTS.md → "Claude integration (`/api/analyze`, `/api/brief`)" for the full contract of each. Each route owns its own `MODEL` constant; if you bump one, check AGENTS.md's mirrored mention stays accurate.
- No other Claude-Code-only conventions currently apply here. Commands, architecture, test coverage, deployment, and the authority model all live in `AGENTS.md` — edit there, not here, to avoid the two files drifting apart again.

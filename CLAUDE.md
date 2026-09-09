@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) specifically. `AGENTS.md` (imported above) is canonical for this repo's architecture, authority model, RULES, and commands — every agent including Claude Code follows it. This file only adds what's Claude-specific; it does not re-describe the app.

## Claude-specific notes

- The one place this repo talks to Claude directly is `/api/analyze` (`src/app/api/analyze/route.ts`, via `@anthropic-ai/sdk`) — see AGENTS.md → "Claude integration (`/api/analyze`)" for the full contract. If you bump the model, update the `MODEL` constant there and check AGENTS.md's mirrored mention stays accurate.
- No other Claude-Code-only conventions currently apply here. Commands, architecture, test coverage, deployment, and the authority model all live in `AGENTS.md` — edit there, not here, to avoid the two files drifting apart again.

@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) specifically. `AGENTS.md` (imported above) is canonical for this repo's architecture, authority model, RULES, and commands — every agent including Claude Code follows it. This file only adds what's Claude-specific; it does not re-describe the app.

## Claude-specific notes

- These two model routes serve the front door: `/api/analyze` (`src/app/api/analyze/route.ts`) for file-based artifact analysis, and `/api/brief` (`src/app/api/brief/route.ts`) for the Brief tab's Daily Brief / Triage / Ask-a-question / Architect Scan / Break Wall features over real mission rows (also reached from the Territory tab's mission detail) — file analysis calls `@anthropic-ai/sdk` directly; Brief/Territory uses `modelProviderChain.ts` (Claude → Gemini when configured → OpenAI), reporting the answering provider/model and fallback reasons. See AGENTS.md → "Claude integration (`/api/analyze`, `/api/brief`)" for the full contract of each. File analysis owns its `MODEL` constant; Brief uses the existing provider-chain defaults/overrides. If changing a model, keep AGENTS.md and `docs/EMAIL-SIGN-IN.md` accurate.
- No other Claude-Code-only conventions currently apply here. Commands, architecture, test coverage, deployment, and the authority model all live in `AGENTS.md` — edit there, not here, to avoid the two files drifting apart again.

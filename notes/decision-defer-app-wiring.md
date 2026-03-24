# Decision — defer local ↔ Vercel wiring

**Date:** 2026-03-24  
**Status:** Active default

## Choice

Keep **local npm agents** (`route`, `triage`, `rank`, biometrics file mode, etc.) **separate** from the **Vercel web app** until a concrete pain appears.

**Production truth** stays [legacy-codex.vercel.app](https://legacy-codex.vercel.app) for what ships publicly; **this repo** stays the operating layer for captures, queues, and blockers.

## Revisit when

Edit this line when you have a real trigger (e.g. duplicate work, drift you feel weekly):

> **Reopen wiring if:** _(not yet — add one sentence when it hurts)_

## FREEZE

Full wiring that changes the live app still requires explicit escalation: `REWRITE THE APP CODE` (see `AGENTS.md`).

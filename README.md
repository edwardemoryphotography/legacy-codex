# legacy-codex — Local body (v37)

Grounding workspace for Legacy Codex: blockers, delegation, and session continuity. **Production behavior** is defined by what is live at [legacy-codex.vercel.app](https://legacy-codex.vercel.app).

## How it all fits together

This repo is one system with five moving parts. Each part lives in its own
folder; here's what each does and how they connect.

| Part | Lives in | What it does |
| --- | --- | --- |
| **The routing brain** | [`src/agents/`](src/agents/) | Takes a raw capture (voice note, thought, task) and sorts it into a lane. [`routeOmega`](src/agents/routeOmega.ts) does the routing using the rules in [DELEGATION_RULES_v1.md](DELEGATION_RULES_v1.md); [`triage`](src/agents/triage.ts), [`distiller`](src/agents/distiller.ts), and [`taskRanker`](src/agents/taskRanker.ts) clean up, compress, and re-prioritize. |
| **The rulebook** | [`AGENTS.md`](AGENTS.md), [`DELEGATION_RULES_v1.md`](DELEGATION_RULES_v1.md) | The plain-language definitions of the roles, routes (A–E), and V37 anchors that the routing brain follows. The docs and the code are two halves of the same thing. |
| **The Foundry Console** | [`foundry-console/`](foundry-console/) | A separate web dashboard (Next.js + Supabase) for tracking sprints, milestones, and friction logs. Stands alone — it reads the work, it doesn't run the agents. |
| **The repo factory** | [`scripts/`](scripts/), [`repo-starters/`](repo-starters/), [`rollout-bundles/`](rollout-bundles/) | Stamps out standard files (README, SECURITY, CHANGELOG, CI) across the other Codex repos so they all follow one baseline. `rollout_repo_standards.py` is the engine. |
| **Session memory** | [`notes/`](notes/), [`logs/`](logs/) | Where decisions, blockers, and resume points get written down so nothing is lost between sessions. This is the cure for fragmentation — if a decision matters, it lands here. |

> **The Muse / biometric thread** runs through several parts: [`taskRanker`](src/agents/taskRanker.ts)
> reads biometric state, and the integration plan lives in
> [notes/muse-integration-finalization-plan.md](notes/muse-integration-finalization-plan.md).

| Start here | Role |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Roles, permissions, V37 anchors, specialist agents |
| [GEMINI.md](GEMINI.md) | Short context for Gemini CLI in this repo |
| [SHIPPING_BLOCKER.txt](SHIPPING_BLOCKER.txt) | Single current shipping blocker sentence |
| [DELEGATION_RULES_v1.md](DELEGATION_RULES_v1.md) | Capture → lane routing |
| [notes/DAILY_STARTUP_v37.md](notes/DAILY_STARTUP_v37.md) | Minimal daily startup sequence |
| [notes/TEMPLATE_SESSION_RESUME.md](notes/TEMPLATE_SESSION_RESUME.md) | Session / resumption template |

## Local automation (npm)

TypeScript agents load secrets from a root **`.env`** via `dotenv` (see `src/lib/gemini.ts`).

1. Copy [`.env.example`](.env.example) to `.env` and set at least **`GEMINI_API_KEY`** (Google AI).
2. Run `npm install` if dependencies are not installed yet.
3. Try automated routing:

```bash
npm run route "[VOICE-SYNC] We need to finalize the Muse integration today."
```

**`VERCEL_TOKEN`** and **`VERCEL_PROJECT_ID`** are only needed for `npm run vercel-bridge`; routing does not require them.

To see **which Git ref production is on**, run `npm run vercel-bridge` and paste branch/SHA into [`notes/VERCEL_PRODUCTION_REF.md`](notes/VERCEL_PRODUCTION_REF.md).

If **`vercel-bridge`** prints **Not authorized**: create a new token at [vercel.com/account/tokens](https://vercel.com/account/tokens), confirm **`VERCEL_PROJECT_ID`** is the `prj_…` value from the project **Settings → General**, and if the project is under a **team**, set **`VERCEL_TEAM_ID`** from team settings.

**Biometrics (`npm run rank`):** set **`BIOMETRICS_SOURCE=file`** in `.env`, copy [`notes/biometric-state.example.json`](notes/biometric-state.example.json) to **`notes/biometric-state.json`**, and have your Muse/local bridge update that file; otherwise leave default **`mock`**.

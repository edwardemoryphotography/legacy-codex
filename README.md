# legacy-codex — Local body (v37)

Grounding workspace for Legacy Codex: blockers, delegation, and session continuity. **Production behavior** is defined by what is live at [legacy-codex.vercel.app](https://legacy-codex.vercel.app).

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

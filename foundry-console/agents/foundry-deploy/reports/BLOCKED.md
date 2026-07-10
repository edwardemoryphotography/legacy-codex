# Foundry Deploy Agent — BLOCKED

- Started: `2026-07-10T08:23Z`
- Repo root: `/workspace`
- Script run: `./scripts/foundry-deploy-agent.sh` → exit `1`
- Script report: `foundry-console/agents/foundry-deploy/reports/run-20260710T082259Z.md`

## Status by step

| Step | Result | Notes |
|------|--------|-------|
| 1 Schema | ❌ blocked | No DDL credential |
| 2 Deploy | ❌ blocked | No `VERCEL_TOKEN` |
| 3 Verify | ⚠️ probed only | See public probes below |
| 4 Smoke | ❌ blocked | No anon key |

## Missing secrets (exact)

| Secret | Present? | Notes |
|--------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ❌ missing from env | Known non-secret value: `https://pkydkbuodikttfeawqsw.supabase.co` — still must be injected for the script |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ missing | Not in env, `.env*`, GH Actions secrets (403), or any public JS bundle |
| `SUPABASE_SERVICE_ROLE_KEY` **or** `SUPABASE_DB_URL` **or** `SUPABASE_ACCESS_TOKEN` | ❌ all missing | Need at least one for step 1 DDL (`ACCESS_TOKEN` or `DB_URL` preferred; service role alone cannot apply `SCHEMA.sql`) |
| `VERCEL_TOKEN` | ❌ missing | Required for step 2 |
| `VERCEL_ORG_ID` | ❌ missing (optional) | Hint from `STATE.md`: `team_vp0GcqRDdFkQQ3NRZU9NJ11O` |
| `VERCEL_PROJECT_ID` | ❌ missing (optional) | |

### What *is* in the Cloud Agent environment

- `CLOUD_AGENT_ALL_SECRET_NAMES` = `API key,GEMINI_API_KEY` only
- `CLOUD_AGENT_INJECTED_SECRET_NAMES` = `GEMINI_API_KEY`
- No Supabase / Vercel secrets are configured for this environment

### Hunt results (no secret values printed)

- Env vars: all Foundry/Supabase/Vercel keys **MISSING**
- `/workspace/.env.local`, `foundry-console/.env.local`: **absent** (only `.env.local.example`)
- `gh secret list`: **HTTP 403** (integration cannot read Actions secrets)
- Vercel CLI config: present but **unauthenticated** (no token)
- Repo scan: **no** embedded JWTs / anon keys
- Public Vercel JS extraction: **blocked** — Production Next deployments are SSO-gated; `foundry-console.vercel.app` is a public Vite app with **no** Supabase JWT in its bundle

## One-line fix

Add these to **Cursor Cloud Agent environment secrets**, then re-run `./scripts/foundry-deploy-agent.sh`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://pkydkbuodikttfeawqsw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon/public key>
SUPABASE_ACCESS_TOKEN=<supabase personal access token>   # or SUPABASE_DB_URL / SUPABASE_SERVICE_ROLE_KEY
VERCEL_TOKEN=<vercel token>
VERCEL_ORG_ID=team_vp0GcqRDdFkQQ3NRZU9NJ11O              # optional but recommended
```

Environment dashboard: https://cursor.com/dashboard/cloud-agents/environments/r/github.com/edwardemoryphotography/legacy-codex

## Public probes (ran without secrets)

1. **`https://foundry-console.vercel.app/`** → HTTP 200, Vite shell (`vite.svg`, title `foundry-console`) — **wrong app** (not the Next Foundry Console). Bundle has no extractable Supabase anon JWT.
2. **Latest Production – foundry-console** (`https://foundry-console-pznwqwj4d-edwardemoryphotographys-projects.vercel.app/`) → HTTP **302** → `https://vercel.com/sso-api?...` — **SSO-gated**; cannot verify login wall or scrape `NEXT_PUBLIC_*` from JS.
3. **`/dashboard`** on that deploy → also **302** SSO.
4. **Supabase** `https://pkydkbuodikttfeawqsw.supabase.co/rest/v1/` → HTTP 401 without a valid apikey (project reachable; keys required for any further work).

## Do not invent keys

No credentials were fabricated. Re-run the agent only after the secrets above are injected.

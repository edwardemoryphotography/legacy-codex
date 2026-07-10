# Foundry Deploy Agent

Autonomous go-live agent for **The Foundry Console** (Case Study Zero).

## Mission

Execute these four steps in order, with no human in the loop once secrets are present:

1. **Apply schema** — run `foundry-console/SCHEMA.sql` against the Supabase project
2. **Deploy** — ship `foundry-console/` to Vercel (root = that directory)
3. **Verify** — open the live URL; confirm no magic-link / login wall
4. **Smoke** — create a real workspace + sprint via the anon key; confirm the row and an audit event exist in Supabase

## How to run

```bash
# Required secrets (Cursor Cloud Agent environment, or local export)
export NEXT_PUBLIC_SUPABASE_URL=https://pkydkbuodikttfeawqsw.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export SUPABASE_ACCESS_TOKEN=...   # or SUPABASE_DB_URL / SUPABASE_SERVICE_ROLE_KEY
export VERCEL_TOKEN=...
# optional: VERCEL_ORG_ID=team_vp0GcqRDdFkQQ3NRZU9NJ11O

./scripts/foundry-deploy-agent.sh
```

Flags:

| Env | Effect |
|-----|--------|
| `DRY_RUN=1` | Print plan only |
| `SKIP_SCHEMA=1` | Skip step 1 |
| `SKIP_DEPLOY=1` | Skip step 2; use `FOUNDRY_PUBLIC_URL` |
| `FOUNDRY_PUBLIC_URL` | Force URL for verify + smoke |

Reports land in `foundry-console/agents/foundry-deploy/reports/`.

## Hard rules

- No mock data. Smoke test writes and reads real rows.
- Zero sign-in: if the live site shows a magic-link form, fail step 3.
- Use only the anon key for app traffic; privileged keys are for DDL/deploy only.
- Do not delete data. Events stay append-only.

## Success criteria

- Exit code `0`
- Report shows all four steps ✅
- Live URL loads `/dashboard` without auth
- A sprint titled `Smoke Sprint <timestamp>` exists in Supabase and an event `deploy_agent.smoke` is in `events`

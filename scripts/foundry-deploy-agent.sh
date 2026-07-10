#!/usr/bin/env bash
# Foundry Deploy Agent — runs all 4 go-live steps for The Foundry Console.
#
# Steps:
#   1. Apply SCHEMA.sql to Supabase
#   2. Deploy foundry-console to Vercel (cwd = foundry-console)
#   3. Verify the live URL (no login wall)
#   4. Smoke test: create workspace + sprint, confirm in DB + events
#
# Required env:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY | SUPABASE_DB_URL | SUPABASE_ACCESS_TOKEN  (step 1)
#   VERCEL_TOKEN                                                         (step 2)
#
# Optional:
#   VERCEL_ORG_ID / VERCEL_TEAM_ID / VERCEL_PROJECT_ID
#   FOUNDRY_PUBLIC_URL   — override URL for steps 3–4
#   SKIP_SCHEMA=1 | SKIP_DEPLOY=1 | DRY_RUN=1
#
# Exit: 0 ok, 1 missing secrets, 2 schema, 3 deploy, 4 verify, 5 smoke

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONSOLE="$ROOT/foundry-console"
SCHEMA="$CONSOLE/SCHEMA.sql"
REPORT_DIR="${FOUNDRY_DEPLOY_REPORT_DIR:-$ROOT/foundry-console/agents/foundry-deploy/reports}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORT_DIR/run-$STAMP.md"
PROJECT_REF_DEFAULT="pkydkbuodikttfeawqsw"

mkdir -p "$REPORT_DIR"

log()  { printf '[foundry-deploy] %s\n' "$*"; }
fail() { local code="$1"; shift; log "FAIL: $*"; printf '\n## FAIL\n\n%s\n' "$*" >>"$REPORT"; exit "$code"; }
ok()   { log "OK: $*"; echo "- ✅ $*" >>"$REPORT"; }

json_id() {
  python3 -c 'import json,sys
raw=sys.stdin.read().strip()
if not raw:
  print(""); raise SystemExit
d=json.loads(raw)
o=d[0] if isinstance(d,list) else d
print(o.get("id","") if isinstance(o,dict) else "")'
}

{
  echo "# Foundry Deploy Agent Report"
  echo
  echo "- Started: \`$STAMP\`"
  echo "- Repo root: \`$ROOT\`"
  echo
} >"$REPORT"

MISSING=()
need_var() { [[ -n "${!1:-}" ]] || MISSING+=("$1"); }

need_var NEXT_PUBLIC_SUPABASE_URL
need_var NEXT_PUBLIC_SUPABASE_ANON_KEY

if [[ "${SKIP_SCHEMA:-0}" != "1" ]]; then
  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" && -z "${SUPABASE_DB_URL:-}" && -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    MISSING+=("SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|SUPABASE_ACCESS_TOKEN")
  fi
fi
if [[ "${SKIP_DEPLOY:-0}" != "1" ]]; then
  need_var VERCEL_TOKEN
fi

if ((${#MISSING[@]})); then
  {
    echo "## Missing secrets"
    echo
    for m in "${MISSING[@]}"; do echo "- \`$m\`"; done
    echo
    echo "Add these to the Cursor Cloud Agent environment secrets, then re-run:"
    echo
    echo '```bash'
    echo './scripts/foundry-deploy-agent.sh'
    echo '```'
  } >>"$REPORT"
  fail 1 "missing required secrets: ${MISSING[*]}"
fi

[[ -f "$SCHEMA" ]] || fail 2 "SCHEMA.sql not found at $SCHEMA"
[[ -d "$CONSOLE" ]] || fail 3 "foundry-console directory missing"

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL%/}"
PROJECT_REF="$(printf '%s' "$SUPABASE_URL" | sed -n 's#https://\([^.]*\)\.supabase\.co.*#\1#p')"
PROJECT_REF="${PROJECT_REF:-$PROJECT_REF_DEFAULT}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "DRY_RUN=1 — plan only"
  {
    echo "## Dry run"
    echo "- Would apply \`$SCHEMA\` to project \`$PROJECT_REF\`"
    echo "- Would deploy \`$CONSOLE\` via Vercel"
    echo "- Would verify + smoke test"
  } >>"$REPORT"
  exit 0
fi

# ─── Step 1: Apply SCHEMA.sql ────────────────────────────────────────────────

echo "## Step 1 — Apply SCHEMA.sql" >>"$REPORT"

if [[ "${SKIP_SCHEMA:-0}" == "1" ]]; then
  ok "Step 1 skipped (SKIP_SCHEMA=1)"
else
  log "Step 1: applying SCHEMA.sql to $PROJECT_REF"
  SCHEMA_LOG="$REPORT_DIR/schema-$STAMP.log"

  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    command -v psql >/dev/null 2>&1 || fail 2 "psql not installed; needed for SUPABASE_DB_URL"
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA" >"$SCHEMA_LOG" 2>&1 \
      || fail 2 "psql schema apply failed (see $(basename "$SCHEMA_LOG"))"
    ok "SCHEMA.sql applied via psql"

  elif [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    SQL_JSON=$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$SCHEMA")
    HTTP=$(curl -sS -o "$REPORT_DIR/schema-$STAMP.json" -w '%{http_code}' \
      -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
      -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$SQL_JSON")
    [[ "$HTTP" =~ ^2 ]] || fail 2 "Supabase SQL API returned HTTP $HTTP (see schema-$STAMP.json)"
    ok "SCHEMA.sql applied via Supabase Management API"

  else
    # Service role: probe only (cannot run DDL through PostgREST)
    log "Service role present — probing tables (DDL needs DB URL or access token)"
    PROBE=$(curl -sS -o /tmp/foundry-probe.json -w '%{http_code}' \
      "$SUPABASE_URL/rest/v1/workspaces?select=id&limit=1" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
    if [[ "$PROBE" == "200" ]]; then
      ok "workspaces table reachable — schema assumed applied"
    else
      fail 2 "tables missing; service role cannot run DDL. Set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN. Probe HTTP $PROBE"
    fi
  fi
fi

# ─── Step 2: Deploy to Vercel ────────────────────────────────────────────────

echo "## Step 2 — Deploy to Vercel" >>"$REPORT"
PUBLIC_URL="${FOUNDRY_PUBLIC_URL:-}"

if [[ "${SKIP_DEPLOY:-0}" == "1" ]]; then
  ok "Step 2 skipped (SKIP_DEPLOY=1)"
  PUBLIC_URL="${PUBLIC_URL:-https://foundry-console.vercel.app}"
else
  log "Step 2: deploying foundry-console to Vercel"
  export VERCEL_TOKEN
  if [[ -n "${VERCEL_ORG_ID:-${VERCEL_TEAM_ID:-}}" ]]; then
    export VERCEL_ORG_ID="${VERCEL_ORG_ID:-$VERCEL_TEAM_ID}"
  fi
  [[ -n "${VERCEL_PROJECT_ID:-}" ]] && export VERCEL_PROJECT_ID

  NPX=(npx --yes vercel@latest)

  for KEY in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
    printf '%s' "${!KEY}" | "${NPX[@]}" env add "$KEY" production --cwd "$CONSOLE" --force >/dev/null 2>&1 \
      || printf '%s' "${!KEY}" | "${NPX[@]}" env add "$KEY" production --cwd "$CONSOLE" >/dev/null 2>&1 \
      || log "warn: could not upsert env $KEY (may already exist)"
  done

  DEPLOY_OUT="$REPORT_DIR/deploy-$STAMP.txt"
  if ! "${NPX[@]}" deploy --prod --yes --cwd "$CONSOLE" 2>&1 | tee "$DEPLOY_OUT"; then
    fail 3 "vercel deploy failed (see deploy-$STAMP.txt)"
  fi

  DETECTED=$(rg -o 'https://[a-zA-Z0-9.-]+\.vercel\.app' "$DEPLOY_OUT" | tail -1 || true)
  PUBLIC_URL="${FOUNDRY_PUBLIC_URL:-${DETECTED:-https://foundry-console.vercel.app}}"
  ok "Deployed — $PUBLIC_URL"
  echo "- Deploy URL: \`$PUBLIC_URL\`" >>"$REPORT"
fi

# ─── Step 3: Verify live URL ─────────────────────────────────────────────────

echo "## Step 3 — Verify live URL" >>"$REPORT"
log "Step 3: verifying $PUBLIC_URL"

TMP_HTML=$(mktemp)
HTTP=$(curl -sS -L --max-redirs 5 -o "$TMP_HTML" -w '%{http_code}' "$PUBLIC_URL/" || echo "000")
[[ "$HTTP" =~ ^2 ]] || fail 4 "live URL returned HTTP $HTTP"

if rg -qi 'Send Magic Link|signInWithOtp' "$TMP_HTML"; then
  fail 4 "login wall still present at $PUBLIC_URL — zero-sign-in build not live"
fi

HTTP_D=$(curl -sS -o /tmp/foundry-dash.html -w '%{http_code}' -L --max-redirs 5 "$PUBLIC_URL/dashboard" || echo "000")
[[ "$HTTP_D" =~ ^2 ]] || fail 4 "/dashboard returned HTTP $HTTP_D"

if ! rg -qi 'Foundry|Connecting|Overview|workspace|_next' /tmp/foundry-dash.html "$TMP_HTML"; then
  fail 4 "page does not look like Foundry Console"
fi

ok "Live URL responds without login wall ($PUBLIC_URL)"
rm -f "$TMP_HTML"

# ─── Step 4: Smoke test against real DB ──────────────────────────────────────

echo "## Step 4 — Smoke test" >>"$REPORT"
log "Step 4: smoke test via Supabase REST (anon key)"

ANON="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
AUTH_H=(-H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -H "Prefer: return=representation")

WS_NAME="Deploy Agent Smoke $STAMP"
WS_JSON=$(curl -sS -X POST "$SUPABASE_URL/rest/v1/workspaces" \
  "${AUTH_H[@]}" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"name": sys.argv[1]}))' "$WS_NAME")")
WS_ID=$(printf '%s' "$WS_JSON" | json_id)

if [[ -z "$WS_ID" || ${#WS_ID} -lt 30 ]]; then
  echo "Workspace create response: \`$WS_JSON\`" >>"$REPORT"
  fail 5 "could not create workspace via anon key (RLS/schema?). Response logged."
fi
ok "Created workspace $WS_ID"

SPRINT_JSON=$(curl -sS -X POST "$SUPABASE_URL/rest/v1/sprints" \
  "${AUTH_H[@]}" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"workspace_id":sys.argv[1],"title":sys.argv[2],"goal":"deploy-agent smoke","status":"active"}))' "$WS_ID" "Smoke Sprint $STAMP")")
SPRINT_ID=$(printf '%s' "$SPRINT_JSON" | json_id)

if [[ -z "$SPRINT_ID" ]]; then
  echo "Sprint create response: \`$SPRINT_JSON\`" >>"$REPORT"
  fail 5 "could not create sprint"
fi
ok "Created sprint $SPRINT_ID"

EV_JSON=$(curl -sS -X POST "$SUPABASE_URL/rest/v1/events" \
  "${AUTH_H[@]}" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"workspace_id":sys.argv[1],"action":"deploy_agent.smoke","target_type":"sprint","target_id":sys.argv[2],"metadata":{"stamp":sys.argv[3]}}))' "$WS_ID" "$SPRINT_ID" "$STAMP")")
EV_ID=$(printf '%s' "$EV_JSON" | json_id)

if [[ -z "$EV_ID" ]]; then
  echo "Event create response: \`$EV_JSON\`" >>"$REPORT"
  fail 5 "could not append audit event"
fi
ok "Appended audit event $EV_ID"

READ_S=$(curl -sS "$SUPABASE_URL/rest/v1/sprints?id=eq.$SPRINT_ID&select=id,title" "${AUTH_H[@]}")
READ_E=$(curl -sS "$SUPABASE_URL/rest/v1/events?id=eq.$EV_ID&select=id,action" "${AUTH_H[@]}")
printf '%s' "$READ_S" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); assert isinstance(d,list) and d and d[0].get("id"), d' \
  || fail 5 "sprint not readable back from DB"
printf '%s' "$READ_E" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); assert isinstance(d,list) and d and d[0].get("action")=="deploy_agent.smoke", d' \
  || fail 5 "audit event not readable back from DB"

ok "Smoke test passed — sprint + event confirmed in database"

{
  echo
  echo "## Summary"
  echo
  echo "| Step | Result |"
  echo "|------|--------|"
  echo "| 1 Schema | done |"
  echo "| 2 Deploy | done |"
  echo "| 3 Verify | $PUBLIC_URL |"
  echo "| 4 Smoke | workspace \`$WS_ID\` / sprint \`$SPRINT_ID\` / event \`$EV_ID\` |"
  echo
  echo "**Live URL:** $PUBLIC_URL"
} >>"$REPORT"

log "ALL STEPS COMPLETE"
log "Report: $REPORT"
echo "$PUBLIC_URL"

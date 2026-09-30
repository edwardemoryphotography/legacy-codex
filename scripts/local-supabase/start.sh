#!/usr/bin/env bash
# Local Supabase-compatible stack for verifying Mission persistence in a real
# browser session without writing to production. Every Vercel preview reads
# and writes project pkydkbuodikttfeawqsw, so a browser walk on a preview
# creates production records; this stack does not.
#
#   Postgres 16 (apt) + Supabase Auth + PostgREST + scripts/local-supabase/proxy.mjs
#   Schema: the canonical actions base table (created in
#   codex-system-architecture 20260520120000, reproduced below) and every
#   migration in supabase/migrations, in order.
#
# Usage (Ubuntu, sudo, no Docker needed):
#   scripts/local-supabase/start.sh            # → http://localhost:54321
#   cp "$STACK_DIR/env.local" .env.local        # only if you have no real .env.local
#   npm run build && npx next start -p 3000    # NEXT_PUBLIC_* are inlined at build
# Re-running is safe; it reuses the database and restarts the services.
set -euo pipefail

STACK_DIR="${STACK_DIR:-/tmp/lstack}"
AUTH_VERSION="${AUTH_VERSION:-v2.197.0}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v16.4}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$STACK_DIR"
cd "$STACK_DIR"
psql_admin() { sudo -u postgres PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 "$@"; }

if ! command -v pg_ctlcluster >/dev/null; then
  sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/dev/null
fi
PG_MAJOR="$(ls /usr/lib/postgresql | sort -n | tail -1)"
sudo pg_ctlcluster "$PG_MAJOR" main start 2>/dev/null || true

[ -x auth ] || { curl -sL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-amd64.tar.xz" | tar -xJ; }
[ -x postgrest ] || { curl -sL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz" | tar -xJ; }
[ -f jwt_secret ] || node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > jwt_secret
JWT_SECRET="$(cat jwt_secret)"

psql_admin <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator login password 'localpw' noinherit; end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login password 'localpw' createrole noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth, public to anon, authenticated, service_role;
grant create on database postgres to supabase_auth_admin;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create extension if not exists pgcrypto;
SQL

cat > auth.env <<EOF
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:localpw@127.0.0.1:5432/postgres?search_path=auth
GOTRUE_DB_NAMESPACE=auth
API_EXTERNAL_URL=http://localhost:54321/auth/v1
GOTRUE_API_HOST=127.0.0.1
PORT=9999
GOTRUE_SITE_URL=http://localhost:3000
GOTRUE_JWT_SECRET=$JWT_SECRET
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_RATE_LIMIT_ANONYMOUS_USERS=1000
EOF
(set -a; . ./auth.env; set +a; ./auth migrate >/dev/null)
psql_admin -c 'grant execute on all functions in schema auth to anon, authenticated, service_role;'

psql_admin <<'SQL'
create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  action_title text not null,
  status text not null default 'TODO',
  context_complexity text,
  portfolio_segment text,
  priority_weight numeric not null default 0,
  is_next_action boolean not null default false,
  created_at timestamptz not null default now(),
  constraint actions_status_check check (status in ('TODO', 'IN_PROGRESS', 'DONE'))
);
alter table actions enable row level security;
SQL

# 0001 references nd_captures, which production created before it; the
# second pass settles 0001 and re-applies the evidence hardening after it.
# codex_documents migrations fail harmlessly (that table is not needed here).
if [ ! -f .migrated ]; then
  for f in "$REPO"/supabase/migrations/*.sql; do psql_admin -f "$f" >/dev/null 2>&1 || echo "skipped: $(basename "$f")"; done
  for f in 0001_mission_loop 20260809090000_scope_evidence_snapshots_read_to_owned_missions 20260809135000_harden_evidence_snapshots_privileges 20260809135500_restrict_evidence_snapshots_remaining_privileges; do
    psql_admin -f "$REPO/supabase/migrations/$f.sql" >/dev/null
  done
  # Supabase's default grants for tables whose migrations do not grant explicitly.
  psql_admin -c 'grant all on missions, mission_events, nd_prefs, nd_captures, nd_codex_bookmarks to anon, authenticated, service_role;'
  touch .migrated
fi

cat > postgrest.conf <<EOF
db-uri = "postgres://authenticator:localpw@127.0.0.1:5432/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
EOF

ANON_KEY="$(JWT_SECRET="$JWT_SECRET" node -e '
const c = require("crypto"); const b = o => Buffer.from(JSON.stringify(o)).toString("base64url")
const h = b({ alg: "HS256", typ: "JWT" }), p = b({ role: "anon", iss: "supabase", iat: 1758700000, exp: 2074060000 })
process.stdout.write(`${h}.${p}.${c.createHmac("sha256", process.env.JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`)')"
printf 'NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\n' "$ANON_KEY" > env.local

for pidfile in auth.pid postgrest.pid proxy.pid; do
  [ -f "$pidfile" ] && kill "$(cat "$pidfile")" 2>/dev/null || true
done
(set -a; . ./auth.env; set +a; nohup ./auth serve > auth.log 2>&1 & echo $! > auth.pid)
nohup ./postgrest postgrest.conf > postgrest.log 2>&1 & echo $! > postgrest.pid
nohup node "$REPO/scripts/local-supabase/proxy.mjs" > proxy.log 2>&1 & echo $! > proxy.pid
sleep 2
curl -sf http://localhost:54321/auth/v1/health >/dev/null && echo "Local stack ready at http://localhost:54321 (env: $STACK_DIR/env.local)"

-- Neuro UX data tables for Legacy Codex (prefs + quick capture + biometrics trends + codex bookmarks)
-- Pulled via `supabase db pull` from project pkydkbuodikttfeawqsw (2026-06-16) and augmented for auth + user_id scoping.
-- Run: supabase db push (after setting real keys and auth providers)

-- Prefs (one row per user)
create table if not exists nd_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Captures / inbox (many per user)
create table if not exists nd_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Biometric trends persisted (for BiometricsTab sync, beyond static json)
create table if not exists nd_biometric_trends (
  user_id uuid primary key references auth.users(id) on delete cascade,
  days jsonb not null default '[]'::jsonb,
  source text default 'supabase',
  updated_at timestamptz default now()
);

-- Codex bookmarks / saved entries (for CodexTab "saved searches" / pins)
create table if not exists nd_codex_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  created_at timestamptz default now(),
  unique (user_id, entry_id)
);

-- Enable RLS on all
alter table nd_prefs enable row level security;
alter table nd_captures enable row level security;
alter table nd_biometric_trends enable row level security;
alter table nd_codex_bookmarks enable row level security;

-- Policies: user can only access their own rows (requires authenticated user via auth.uid())
create policy "nd_prefs: user owns row" on nd_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "nd_captures: user owns row" on nd_captures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "nd_biometric_trends: user owns row" on nd_biometric_trends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "nd_codex_bookmarks: user owns row" on nd_codex_bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Note: For initial testing with anon key before full auth, you can temporarily add:
-- create policy "nd_prefs anon test" on nd_prefs for all using (true) with check (true);
-- (remove after adding auth)

-- No global seed (per-user now)

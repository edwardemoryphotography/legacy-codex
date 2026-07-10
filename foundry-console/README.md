# The Foundry Console

## Canonical ecosystem role

Foundry Console is the **technical build and operations environment** for Legacy Codex and the wider Artful Intelligence ecosystem.

It answers:

> What exists, what is running, what is broken, and what technical action must happen next?

Foundry owns repositories, applications, services, builds, deployments, integrations, agent operations, diagnostics, audit history, exports, permissions, and module publishing.

It does **not** own the user's daily cognitive homepage, personal journal, energy-aware task selection, friction history, or human project milestones. Those responsibilities belong to Legacy Codex.

**Case Study Zero is a workspace and implementation case inside Foundry Console. It is not the product definition of Foundry Console.**

See:

- `../docs/architecture/PRODUCT_BOUNDARY.md`
- `../docs/architecture/FEATURE_PLACEMENT.md`
- `../docs/superpowers/plans/2026-07-10-legacy-codex-foundry-boundary.md`

## Current implementation

Minimal, fast web console for **Case Study Zero**.  
**No sign-in.** Open the link and you're in — the URL is the key.

Connects to a Supabase backend and shows only real database data. No mock data, no synthetic examples, no analytics.

The current route set predates the canonical product boundary. Preserve it as working implementation evidence, but use the feature-placement registry before extending or relocating features.

## How access works (read this)

There is no login, no magic link, no email loop. The app talks to Supabase
with the **anon key** and open row-level-security policies:

- **Anyone who has the deployed URL can read and write workspace data.**
  Treat the URL like a password — share it only with people you trust.
- The **events** table is append-only *at the database level*: the anon key
  has no update or delete permission on it, and no table has a delete policy
  at all. Nothing can be destroyed through the app.
- The service role key is never used in the frontend.

If you later want real access control, add Supabase auth back and tighten
the RLS policies — the schema supports it.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Supabase JS** (anon key only)
- **Hosting**: Vercel

## Features

| Feature | Route | Canonical placement note |
|---------|-------|--------------------------|
| Overview: live counts, active sprint, next milestone, recent activity | `/dashboard` | Split human progress from technical system health |
| Workspace switcher + create workspaces in-app | Sidebar | Keep in Foundry |
| Sprints: create, list, full-field edit | `/dashboard/sprints` | Split cognitive goal view from technical execution metadata |
| Friction: log, resolve | `/dashboard/friction` | Move primary ownership to Legacy Review / Memory |
| Milestones: timeline, add, complete/reopen | `/dashboard/milestones` | Move human milestones to Legacy Projects |
| Manual: create + edit pages, auto version bump | `/dashboard/manual` | Split user playbooks from technical runbooks |
| Settings: AI kill switch, PII warning toggle | `/dashboard/settings` | Keep in Foundry |
| Audit log: read-only, append-only | `/dashboard/events` | Keep in Foundry |
| Export: full workspace JSON download | `/dashboard/export` | Keep in Foundry |

Every create/update action writes an entry to the audit log automatically.

## Setup

### 1. Database

1. Create a Supabase project (or reuse one)
2. Open **SQL Editor**, paste the contents of `SCHEMA.sql`, run it

### 2. Local development

```bash
cd foundry-console
cp .env.local.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). First visit shows a
one-field "create workspace" screen; after that you land straight on the
Overview.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

## Deploy to Vercel

### Connect GitHub

1. [vercel.com](https://vercel.com) → **Add New… → Project**
2. Import this repository
3. Set **Root Directory** to `foundry-console`
4. Framework preset: Next.js (auto-detected)

### Set env vars

**Settings → Environment Variables**, for Production, Preview, and Development:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |

### Deploy & verify

1. Click **Deploy**
2. Open the Vercel URL — you should immediately see either the
   "create workspace" screen (fresh database) or the Overview (existing data)
3. Create a sprint; confirm it appears in the Supabase table editor and in
   the audit log — that proves the live connection end to end

No auth redirect configuration is needed. There is nothing else to set up.

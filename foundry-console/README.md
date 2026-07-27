# The Foundry Console

Minimal, fast web console for **Case Study Zero**.  
**No sign-in.** Open the link and you're in — the URL is the key.

Connects to a Supabase backend and shows only real database data. No mock data, no synthetic examples, no analytics.

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

| Feature | Route |
|---------|-------|
| Overview: live counts, active sprint, next milestone, recent activity | `/dashboard` |
| Workspace switcher + create workspaces in-app | Sidebar |
| Sprints: create, list, full-field edit | `/dashboard/sprints` |
| Friction: log, resolve | `/dashboard/friction` |
| Milestones: timeline, add, complete/reopen | `/dashboard/milestones` |
| Manual: create + edit pages, auto version bump | `/dashboard/manual` |
| Settings: AI kill switch, PII warning toggle | `/dashboard/settings` |
| Audit log: read-only, append-only | `/dashboard/events` |
| Export: full workspace JSON download | `/dashboard/export` |

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

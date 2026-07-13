# The Foundry Console

Minimal, fast web console for **Case Study Zero**.
Access is restricted to the owner account with email/password authentication.

Connects to a Supabase backend and shows only real database data. No mock data, no synthetic examples, no analytics.

## How access works (read this)

There are no magic links or emailed OTP codes. The owner signs in with a
password, and Supabase persists and refreshes the browser session:

- The app-level gate permits only `freddyv@duck.com`.
- Supabase RLS independently enforces the same owner email on all seven tables.
- The anonymous database role has no table privileges.
- The **events** table is append-only at the database level: authenticated
  clients have only `SELECT` and `INSERT` privileges and policies.
- The service role key is never used in the frontend.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Supabase JS** (public client key + authenticated owner session)
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
2. Enable email/password authentication and create the confirmed owner user
3. Open **SQL Editor**, paste the contents of `SCHEMA.sql`, run it

### 2. Local development

```bash
cd foundry-console
cp .env.local.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the owner
password. A valid session persists across reloads; signing out returns to the
password screen.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public client key; anonymous table privileges remain revoked |

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
2. Open the Vercel URL and verify the owner password screen appears
3. Sign in, reload, and confirm the session persists
4. Create a sprint; confirm it appears in the Supabase table editor and in
   the audit log — that proves the live connection end to end

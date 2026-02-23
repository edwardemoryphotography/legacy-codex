# The Foundry Console

Minimal Next.js web console for **Case Study Zero**, connected directly to an
existing Supabase backend (RLS-respecting, no mock data).

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase JS (`@supabase/supabase-js`, `@supabase/ssr`)
- Hosting target: Vercel

## Hard guarantees in this console

- No mock data, no seeded rows, no synthetic examples.
- Empty states only when data is absent.
- No service role key in frontend code.
- Uses only:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Audit log (`events`) view is read-only in UI.

## Features implemented

1. Supabase magic link auth.
2. Workspace selection from `workspace_members`.
3. Workspace views:
   - Sprints list + sprint detail editor (all discovered sprint row fields)
   - Friction entries list + add entry
   - Milestones timeline + add milestone
   - Manual page edit (admin-only) with explicit `version` field
   - Settings (admin-only): `kill_switch_ai`, `pii_warning_enabled`
   - Audit log (`events`) read-only
4. JSON export endpoint for workspace data:
   - sprints
   - friction entries
   - milestones
   - events

## Local run instructions

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local env file:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Run dev server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Build check

```bash
npm run build
```

## Vercel deploy instructions

### 1) Connect GitHub repository

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import this GitHub repository.
3. Select the project root as `foundry-console`.

### 2) Set environment variables in Vercel

In **Project Settings → Environment Variables**, add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Apply to:

- Preview
- Production

Then redeploy.

### 3) Verify deployment is live

1. Open the deployed URL shown in Vercel.
2. Confirm `/login` renders.
3. Send magic link and complete sign-in.
4. Confirm `/workspaces` lists only real workspaces from Supabase.
5. Open a workspace and verify:
   - Sprints/friction/milestones/events show either real rows or empty states.
   - Admin-only pages are hidden/blocked for non-admin roles.
6. Click **Download JSON export** and validate downloaded JSON contains:
   - `sprints`
   - `friction_entries`
   - `milestones`
   - `events`

## Notes

- If your schema uses alternate column names for manual content fields, use the
  manual editor’s additional JSON object field to include required columns.
- RLS policies must permit the authenticated user to read/write rows as needed.

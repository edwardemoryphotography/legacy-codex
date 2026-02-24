# The Foundry Console

Minimal Next.js web console for **Case Study Zero**.  
Connects to an existing Supabase backend — no mock data, no synthetic examples.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Supabase JS** (@supabase/ssr)
- **Hosting**: Vercel

## Features

| Feature | Route |
|---------|-------|
| Magic-link auth | `/login` |
| Workspace selector | Sidebar (auto-loads from `workspace_members`) |
| Sprints list + edit | `/dashboard/sprints`, `/dashboard/sprints/[id]` |
| Friction log + add | `/dashboard/friction` |
| Milestones timeline + add | `/dashboard/milestones` |
| Manual pages (admin edit) | `/dashboard/manual` |
| Settings (admin) | `/dashboard/settings` |
| Audit log (read-only) | `/dashboard/events` |
| JSON export | `/dashboard/export` |

## Prerequisites

- Node.js 18+
- A Supabase project with the schema from `SCHEMA.sql` applied
- Auth → Email → "Enable Magic Link" turned on in Supabase dashboard

## Local Development

```bash
cd foundry-console

# 1. Install dependencies
npm install

# 2. Create env file
cp .env.local.example .env.local
# Edit .env.local with your Supabase project URL and anon key

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://abc123.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

**Security**: Only the anon key is used in the frontend. RLS policies on the database enforce access control. No service role key is ever exposed to the client.

## Database Setup

1. Open your Supabase project → SQL Editor
2. Paste and run the contents of `SCHEMA.sql`
3. This creates all tables with RLS policies

## Deploy to Vercel

### 1. Connect GitHub

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New…" → Project**
3. Import this repository from GitHub
4. Vercel auto-detects it as a Next.js project

### 2. Set Environment Variables

In the Vercel project settings (**Settings → Environment Variables**):

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |

Set these for **Production**, **Preview**, and **Development** environments.

### 3. Deploy

Click **Deploy**. Vercel will build and deploy automatically.

### 4. Configure Supabase Redirect

After deploying, add your Vercel URL to Supabase:

1. Supabase Dashboard → Authentication → URL Configuration
2. Add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**

### 5. Verify It's Live

1. Visit your Vercel URL (e.g. `https://foundry-console.vercel.app`)
2. You should see the login page
3. Enter your email → receive a magic link → sign in
4. If you're a member of a workspace, you'll see the dashboard

## Security Notes

- Uses only the Supabase **anon key** (never the service role key)
- All data access is governed by Supabase RLS policies
- Admin-only UI (Settings, Manual edit) checks `workspace_members.role`
- Events table is append-only: the UI cannot edit or delete events
- No analytics, no tracking, no cookies beyond auth session

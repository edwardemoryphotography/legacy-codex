# Foundry Console

Foundry Console is the **technical builder and operations environment** for creating, connecting, deploying, inspecting, and maintaining the systems that power Legacy Codex and the wider Artful Intelligence ecosystem.

> **Canonical question:** What exists, what is running, what is broken, and what technical action must happen next?

The current application began as a minimal Next.js web console for **Case Study Zero**. Case Study Zero is now classified as a workspace inside Foundry Console, not the definition of the product itself.

Canonical architecture:

- [`../docs/architecture/PRODUCT_BOUNDARY.md`](../docs/architecture/PRODUCT_BOUNDARY.md)
- [`../docs/architecture/FEATURE_PLACEMENT.md`](../docs/architecture/FEATURE_PLACEMENT.md)
- [`../docs/superpowers/plans/2026-07-10-legacy-codex-foundry-boundary.md`](../docs/superpowers/plans/2026-07-10-legacy-codex-foundry-boundary.md)

## Product responsibility

Foundry Console owns:

- System, application, repository, service, and module registry
- Branch, commit, build, test, deployment, environment, and verification state
- Agent execution, provider routing, task history, and approval state
- Integration configuration and health
- Technical diagnostics, audit trails, exports, and rollback controls
- Module publishing into Legacy Codex
- PocketForge as the mobile builder and execution module

Foundry Console does **not** own:

- The user’s daily cognitive homepage
- Personal journaling or resumption context
- Cognitive friction as a primary record
- Human project meaning, intention, or next-action selection
- A duplicate version of the Legacy Codex Today surface

## Current implementation status

The current routes remain a transitional Case Study Zero implementation. Their canonical placement is:

| Current feature | Current route | Canonical disposition |
|---|---|---|
| Magic-link auth | `/login` | Keep in Foundry |
| Workspace selector | Sidebar | Keep in Foundry → Systems |
| Sprints list + edit | `/dashboard/sprints`, `/dashboard/sprints/[id]` | Split between Legacy project state and Foundry execution state |
| Friction log + add | `/dashboard/friction` | Move to Legacy → Review / Memory after schema inventory |
| Milestones timeline + add | `/dashboard/milestones` | Move to Legacy → Projects after schema inventory |
| Manual pages | `/dashboard/manual` | Split into user playbooks and technical runbooks |
| Settings | `/dashboard/settings` | Keep in Foundry |
| Audit log | `/dashboard/events` | Keep in Foundry → Diagnostics / Audit |
| JSON export | `/dashboard/export` | Keep in Foundry → Data Management |

No route or database migration is authorized until the current schema inventory and route map are completed and reviewed.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Supabase JS** (@supabase/ssr)
- **Hosting**: Vercel

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

Before changing `SCHEMA.sql`, document every current reader and writer in `docs/architecture/SCHEMA_INVENTORY.md` as required by the canonical migration plan.

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

A successful Foundry session must end with a verified technical state change, such as a passing build, verified deployment, diagnosed failure, restored integration, or published module.

## Security Notes

- Uses only the Supabase **anon key** (never the service role key)
- All data access is governed by Supabase RLS policies
- Admin-only UI (Settings, Manual edit) checks `workspace_members.role`
- Events table is append-only: the UI cannot edit or delete events
- No analytics, no tracking, no cookies beyond auth session

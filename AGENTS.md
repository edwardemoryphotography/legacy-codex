# AGENTS.md

This file provides guidance to Codex (Codex.ai/code), Claude Code, Cursor, Grok Build, and any other AI coding agent working with this repository.

## Cross-repo engineering standards

The Legacy Codex Standards Kit (product definition, task lifecycle, design tokens, intelligence governance, SHIPPED ladder) is governed from `codex-control-panel/standards/` (Standards Kit 2.1.0) — this repo is named in Master Charter §1 but does not implement most of it: no Liquid Intelligence design system (this app is dark-only, its own established design) and no AI task-routing/lifecycle surface (the one real AI integration is `/api/analyze`, already following §5.4's server-only-key rule). What does apply: §9 discovery-before-modification, and `standards/AGENT-BEHAVIOR.md`'s baseline conduct (think-before-coding, simplicity, surgical changes, verification) underneath the doctrine below — the doctrine and sanity gate here are repo-specific and take precedence over generic guidance where they overlap.

## Mandatory cognitive doctrine

Before interpreting system-level intent, read the canonical Goose Cookbook:

`EdwardEmoryPhotography/codex-system-architecture/notion-wiki/docs/GOOSE-COOKBOOK.md`

Core rules even if the canonical file is temporarily unavailable:

- **Don't preserve every experience. Preserve what the experience taught the system.**
- **CATCH THE FUCKING BOOMERANG.** When different analogies, artifacts, corrections, implementations, or verified evidence keep returning to the same latent structure, infer the shared architecture instead of treating them as unrelated local topics.
- **The build can become the explanation.** New implementation evidence may make a pre-existing end-state newly legible; do not automatically narrate that as a newly expanded vision.
- **Make the idea representable across different kinds of minds.** Preserve meaning across human narrative, machine-readable structure, and executable software.
- Before closing a task ask: **What did this interaction teach the system that the next instance should not have to rediscover?** If it matters, encode it durably.

## Deployment / environment sanity gate

Repeated Supabase/Vercel configuration rediscovery is a system failure. Before changing deployment code or secrets:

1. Identify the exact target: local, preview, or production.
2. Identify the exact repository, Vercel project, Supabase project, and expected environment-variable names.
3. Compare expected names with what the code actually reads. **Never invent, casually rename, rotate, or paste secrets into code/chat.**
4. Treat public client variables and server-only secrets as different trust boundaries.
5. Verify that the deployment is pointing at the intended Supabase project before diagnosing schema/RLS failures.
6. Distinguish **missing secret**, **wrong environment scope**, **wrong project target**, **stale deployment**, and **application bug** before changing anything.
7. After any environment change, run a fresh deployment and verify the live/preview behavior directly. "Configured" is not "Verified" and "Verified" is not automatically "Live".
8. Record any recurrent failure pattern as durable documentation or a test so the next agent does not rediscover it.

## Workspace coordination

Read this file first, then `STATE.md` for the latest project status, then `TODOS.md` for the approved task queue. Coordination docs are docs/coordination only — they do not authorize application, external-system, or production-data changes.

**Never touch legacy-codex application source without an explicit go-ahead.** See `STATE.md` § FROZEN.

### RULES

1. **Verify before claiming done.** Run or otherwise check your work; don't report success on an unverified change.
2. **Keep `STATE.md` current.** Update its shipped / blocked / next lines after any session that changes them, per its own Update Protocol.
3. **Record only durable lessons.** Append to `STATE.md` § LESSONS only when a repository-specific improvement is worth preserving.
4. **Smallest safe patch, always.** Prefer the minimal change that satisfies the request over a broader rewrite.

## Commands

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve the production build locally
npm run lint     # ESLint
npm test         # Vitest suite
```

Run `npx tsc --noEmit` to check types in isolation.

The root app uses Next.js 16.3.0 and `next.config.mjs`. Do not create a competing root Next config.

## Architecture

### Entry point and tab system

`src/app/page.tsx` is a server component that simply renders `<CodexApp />`. All real logic lives in `src/components/CodexApp.tsx`, a `'use client'` component.

`CodexApp` owns a single piece of state: `activeTab: TabId`. It renders the tablist and conditionally mounts the matching tab component. Tabs are independent except for explicit shared hooks/components such as the capture pipeline and Mission's next-move panel. Adding a tab requires: (1) adding a `TabId` in `src/types/index.ts`, (2) adding an entry to the `TABS` array in `CodexApp.tsx`, and (3) creating the tab component and wiring it in the conditional render block.

### State persistence via `useLocalStorage`

`src/hooks/useLocalStorage.ts` exports `useLocalStorage<T>(key, defaultValue)` → `[value, set, mounted]`.

The hook is SSR-safe: it initialises from `defaultValue` synchronously, then reads `localStorage` in a `useEffect` and resolves to the stored value. The third return value `mounted: boolean` flips to `true` after that effect runs — use it to suppress hydration-sensitive UI (e.g. hide a metric that differs server/client until `mounted`). The `set` function accepts either a value or an updater `(prev: T) => T`, matching the React `setState` signature.

Currently used by: `OverviewTab` (`codex_v27_metrics`), and `ConstraintValidatorTab`.

### Codex data shape (`src/data/codex.ts`)

`CODEX_SECTIONS: CodexSection[]` is the root export — 9 sections (`root`, `council`, `territory`, `artistic`, `neuro`, `automation`, `business`, `personalos`, `convergence`). Each section contains an `entries: CodexEntry[]` array where entries may nest arbitrarily deep via `children?: CodexEntry[]`.

`CodexEntry.content` is a Markdown string. `CodexTab` renders it with `ReactMarkdown` + `remark-gfm`. All helper functions (`flattenEntries`, `getAllEntries`, `findEntryById`, `findSectionByEntryId`, `getSectionEntries`) work recursively on this tree — always use them rather than `.flatMap` directly, since `.flatMap` does not recurse into `children`.

To add a new section: add a `SectionKey` union member in `src/types/index.ts`, build a `CodexSection` object in `codex.ts`, and append it to `CODEX_SECTIONS`. The sidebar and search in `CodexTab` are data-driven and will pick it up automatically.

### Biometrics data contract

`BiometricsTab` fetches `GET /notes/biometric-trends.json` (file must live in `public/notes/`) on mount via an auto-load `useEffect`. It accepts two JSON shapes:

```jsonc
// Shape A — bare array
[{ "date": "2025-01-01", "sleepHours": 7.5, "recoveryScore": 74, "focusScore": 68 }, ...]

// Shape B — object wrapper
{ "source": "whoop-bridge", "days": [ ...same objects... ] }
```

The component takes the last 30 valid records, validates each row with `isValidDay` (requires `date: string`, finite `sleepHours`, `recoveryScore`, `focusScore`), and refuses to render numeric values if the file is absent or yields zero valid rows. **There are no mock values, fixtures, or fallbacks anywhere in this component** — an unavailable file produces an explicit "data required" UI state.

Readiness is computed as: `recovery × 0.48 + focus × 0.32 + min(100, sleep × 12) × 0.20`, clamped 0–100. Execution mode thresholds: `recovery` (readiness < 42 or sleep < 6 h), `admin_light` (readiness 42–58), `creative_edit` (focus > recovery + 12), `deep_build` (otherwise). All thresholds and weights are named constants at the top of `BiometricsTab.tsx`.

A live bridge is expected to write this file externally (WHOOP API, Apple Health export, Muse, etc.). The dashboard has no opinion about how the file is produced — it only reads it.

### Styling system

The design uses CSS custom properties defined in `src/app/globals.css` as the single source of truth for colour, surface, and radius tokens. These are mirrored into the Tailwind theme in `tailwind.config.ts` under shortened aliases (`bg`, `surface`, `tx`, `teal`, `amber`, `error`, `success`, `line`, `codex`/`codex-sm`/`codex-lg` border-radius). Inline `style` props use `var(--*)` directly for values that would be verbose as utility classes. The app is dark-only — there is no light-mode variant.

### Types (`src/types/index.ts`)

This is the single type source for the whole project. Key exports: `TabId` (union of all 7 tab IDs), `BiometricDay / BiometricSummary / BiometricMode`, `CodexEntry / CodexSection / SectionKey`, `ValidationMetric / MetricValue`. When adding a feature that spans multiple files, define its shape here first.

### Supabase integration

`src/lib/supabase/client.ts` creates a browser Supabase client (`@supabase/ssr`'s `createBrowserClient`) against its own project — `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, falling back to project `pkydkbuodikttfeawqsw` if unset (see `.env.local.example`). This is a **separate Supabase project from `codex-system-architecture`'s canonical `supabase-indigo-paddle`** — do not assume shared tables or credentials between the two repos.

`CodexTab` and `ControlsTab` use it for anonymous auth (`signInAnonymously`) plus reads/writes to `nd_codex_bookmarks`, `nd_prefs`, and `nd_captures`. If the client fails to construct (e.g. due to initialization or environment issues), it falls back to a no-op stub. Note that placeholder keys do not prevent construction — `createBrowserClient` succeeds even with the placeholder fallback values — so runtime calls against a misconfigured project fail gracefully via component-level error handling instead.

### Deployment

The layout sets `robots: noindex, nofollow` — this is a private operational dashboard. Most routes are prerendered as static content (`○` in build output), but the app is **not** a pure static export: `next.config.mjs` no longer sets `output: 'export'`, because `/api/analyze` (see below) is a real server-side Route Handler that must run as a Vercel Function. Deploying to a static host (Netlify, GitHub Pages, etc.) would silently drop that route — Vercel (or another Next.js-aware host that provisions serverless functions) is required. This is in addition to the client-side Supabase dependency noted above.

### Codex integration (`/api/analyze`)

`src/app/api/analyze/route.ts` is a Next.js Route Handler that proxies artifact analysis requests to the Codex API using `@anthropic-ai/sdk`. `ANTHROPIC_API_KEY` is read server-side only (`process.env.ANTHROPIC_API_KEY`, no `NEXT_PUBLIC_` prefix) and is never sent to the browser — this is deliberate: unlike some other providers, Anthropic's API refuses direct browser calls by default because a client-exposed key lets anyone burn arbitrary spend on the account, and this app has no login (only `noindex`).

- `GET /api/analyze` returns `{ configured: boolean }` so the client can show/hide the analysis UI without ever seeing the key itself.
- `POST /api/analyze` accepts `multipart/form-data` (`instruction` + one or more `files`), converts each file to an Anthropic content block (PDF → `document`, images → `image`, text/md/csv/json → inline `text`), and calls `client.messages.create` with `model: "Codex-opus-5"`. Unsupported file types (e.g. `.docx`, video) are rejected with a 400 — Codex's Messages API doesn't accept them the way Gemini's `inlineData` did, so `ConstraintValidatorTab`'s accepted-file list was narrowed accordingly.

`ConstraintValidatorTab.tsx` is the only consumer: it checks `/api/analyze` (GET) on mount to enable/disable the Analyze button, then POSTs the selected files as `FormData` on submit.

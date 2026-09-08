# AGENTS.md

This file provides guidance to Codex (Codex.ai/code), Claude Code, Cursor, Grok Build, OpenAI coding agents, and any other AI coding agent working with this repository.

## Authority model

This governs how an agent acts on a request in this repo. It supersedes any earlier rule in this repo that reads as a blanket freeze or a demand for a magic phrase before ordinary engineering work — see "History" below for what changed.

1. The user's current explicit request is the highest-level task intent for the session. When Eddie asks for implementation, redesign, repair, completion, debugging, or similar coding work, that request authorizes the reversible source changes reasonably necessary to reach the requested outcome — across `src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, or any other application source — with no separate go-ahead phrase required.
2. Repository architecture and safety rules (this file, the deployment sanity gate below, the Goose Cookbook doctrine) constrain **how** work is done. They do not silently override a newer, explicit authorization from the user.
3. Reversible implementation work — edits, refactors, debugging, tests, builds, local verification, documentation updates — proceeds autonomously once it is inside the scope of the request. Do not stop to ask permission for it, and do not stop at a plan when implementation was requested.
4. Ask before proceeding only when:
   - a genuinely missing product decision would materially change the outcome,
   - multiple materially different directions are equally plausible and cannot be inferred from context, or
   - the action is destructive, irreversible, externally consequential, security-sensitive, financial, credential-related, or otherwise needs human sign-off (see "Ask first" below).
5. **Ask first — two tiers.** A broad request ("clean things up", "fix the deployment", "build the app") never by itself implies permission for anything in this list; it takes an explicit, specific instruction to unlock either tier.
   - **Never overridable, no matter how the request is phrased — always ask first, even given an explicit instruction:** rotating, generating, or exposing secrets or credentials; disclosing credentials; financial actions (purchases, billing/plan changes, spend commitments); and destructive production-data changes (mutating or deleting live rows/tables in a production database).
   - **Ask first by default, but satisfied by a specific explicit authorization in the current request:** deleting a project, branch, or deployment; alias/DNS changes; force-pushes or history rewrites on shared branches; and other actions that are hard to reverse or reach beyond this checkout. If Eddie names the exact action ("delete the `legacy-codex-kappa` Vercel project", "force-push `branch-x` to fix the diverged history"), that authorizes it — don't ask again for the same named action. Infer nothing beyond what was actually named.
6. Verification is mandatory but proportional to the change (see RULES below) — run the checks that actually establish the result; don't manufacture redundant re-verification once the right check has already passed.
7. A PR, commit, build, or passing test is evidence of progress, not automatically the finished outcome — see "Definition of done" below.

### History: what this replaces

This file and `STATE.md` previously required Eddie to say the literal phrase "REWRITE THE APP CODE" before any agent could touch `src/app/`, `src/components/`, `src/lib/`, or `src/hooks/`. That blanket gate is retired: it didn't distinguish a routine bug fix from an actual ground-up redesign, and it silently overrode explicit task authorization in exactly the way point 2 above forbids. The underlying intent — don't casually rewrite working application code — is preserved as ordinary engineering judgment (smallest necessary patch, per RULES below), not as a permission gate. See `STATE.md` Repo-local notes for the retirement note and its history.

### Definition of done

For coding tasks, "done" means the requested end state is actually reached — not merely planned, committed, or partially evidenced:

- A bug-fix request is done when the bug is fixed and verified, not when a diff exists.
- A redesign/implementation request is done when the implementation is complete and verified, not when a plan is written.
- A "deploy and verify" request is done only after runtime verification; a successful build alone is not done.
- A PR, commit, build, or deployment is evidence of progress toward the outcome the user asked for, not a substitute for it, unless a PR/commit/build was literally all that was asked for.

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

Read this file first, then `STATE.md` for the latest project status, then `TODOS.md` for the approved task queue. Coordination docs are docs/coordination only — they describe state, they do not themselves authorize application, external-system, or production-data changes; the user's explicit request does that (see Authority model above).

### RULES

1. **Verify before claiming done, proportionally.** Run or otherwise check your work — the checks that actually establish the result (tests, lint, `tsc --noEmit`, a build, a manual check for UI work). Don't report success on an unverified change, and don't loop through redundant re-checks once the appropriate one has already passed.
2. **Keep `STATE.md` current.** Update its shipped / blocked / next lines after any session that changes them, per its own Update Protocol.
3. **Record only durable lessons.** Append to `STATE.md` Repo-local notes only when a repository-specific improvement is worth preserving.
4. **Smallest necessary patch.** Prefer the least change that fully satisfies the requested outcome over a broader rewrite — this means trimming scope nobody asked for, not stopping short of the outcome that was asked for.

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

### Strategic Delta (`src/lib/strategicDelta.ts`)

The predictive front door. `MissionTab` renders `<StrategicDelta />` above
everything else, so opening the app answers "what matters right now?" from real
state before the user types anything.

The engine is pure — no I/O, no clock, no randomness (`now` is a parameter) — and
runs five stages: `assembleDeltaContext` → `routeSituation` → `generateCandidates`
→ `inhibit` → `selectStrategicDelta`. These map to the historical CSF / LAR / REK
functions recovered from `EdwardEmoryPhotography/rork-legacy-codex-companion`;
their acronym expansions are *not* treated as canonical, only their behaviour.

**This is the same function `foundry-console/src/lib/derived-state.ts` performs
for the builder layer** (`whatMattersNow` / `nextAction` / `nextActionProvenance`,
honest nulls). It is deliberately re-implemented rather than imported — Legacy
Codex is the human front door and must not depend on Foundry. If you change one,
consider whether the other learned the same thing.

Three rules that are load-bearing, not stylistic:

- **A Delta is a prediction, never automatically an Action.** Accepting one
  records `delta_accepted` in `mission_events`; it must not write to the
  canonical `actions` table. Recommendation ≠ commitment.
- **Provenance is a discriminated union** (`DeltaProvenance`), and colour encodes
  it: spectrum = unresolved cognition, teal = rule-based prediction, violet =
  model-generated, amber = insufficient context. The bounded `/api/delta-operation`
  path may produce `'model'` only after its output passes the same deterministic
  quality and inhibition gates; it must never render as teal.
- **Insufficient context is a first-class path, not a fallback.** With no mission
  state the Delta names the one missing input. It never guesses.

Corrections ("Not right") persist as `delta_corrected` rows in `mission_events`
— that table's `type` column has no CHECK constraint, so new event types need no
migration — and feed back in as an inhibition input. The corrected move stops
being recommended; the prior prediction stays in history rather than being erased.
Because `mission_events.mission_id` is `not null`, an insufficient-context Delta
cannot be corrected (there is no mission to attach it to), and the UI disables
that control rather than failing at runtime.

### Styling system

The design uses CSS custom properties defined in `src/app/globals.css` as the single source of truth for colour, surface, and radius tokens. These are mirrored into the Tailwind theme in `tailwind.config.ts` under shortened aliases (`bg`, `surface`, `tx`, `teal`, `amber`, `error`, `success`, `line`, `codex`/`codex-sm`/`codex-lg` border-radius). Inline `style` props use `var(--*)` directly for values that would be verbose as utility classes. The app is dark-only — there is no light-mode variant.

### Types (`src/types/index.ts`)

This is the single type source for the whole project. Key exports: `TabId` (union of all 7 tab IDs), `BiometricDay / BiometricSummary / BiometricMode`, `CodexEntry / CodexSection / SectionKey`, `ValidationMetric / MetricValue`. When adding a feature that spans multiple files, define its shape here first.

### Supabase integration

`src/lib/supabase/client.ts` creates a browser Supabase client (`@supabase/ssr`'s `createBrowserClient`) against its own project — `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, falling back to project `pkydkbuodikttfeawqsw` if unset (see `.env.local.example`). This is a **separate Supabase project from `codex-system-architecture`'s canonical `supabase-indigo-paddle`** — do not assume shared tables or credentials between the two repos.

`CodexTab` and `ControlsTab` use it for anonymous auth (`signInAnonymously`) plus reads/writes to `nd_codex_bookmarks`, `nd_prefs`, and `nd_captures`. If the client fails to construct (e.g. due to initialization or environment issues), it falls back to a no-op stub. Note that placeholder keys do not prevent construction — `createBrowserClient` succeeds even with the placeholder fallback values — so runtime calls against a misconfigured project fail gracefully via component-level error handling instead.

### Deployment

The layout sets `robots: noindex, nofollow` — this is a private operational dashboard. Most routes are prerendered as static content (`○` in build output), but the app is **not** a pure static export: `next.config.mjs` no longer sets `output: 'export'`, because `/api/analyze` (see below) is a real server-side Route Handler that must run as a Vercel Function. Deploying to a static host (Netlify, GitHub Pages, etc.) would silently drop that route — Vercel (or another Next.js-aware host that provisions serverless functions) is required. This is in addition to the client-side Supabase dependency noted above.

### Claude integration (`/api/analyze`)

`src/app/api/analyze/route.ts` is a Next.js Route Handler that proxies artifact analysis requests to the Claude API using `@anthropic-ai/sdk`. `ANTHROPIC_API_KEY` is read server-side only (`process.env.ANTHROPIC_API_KEY`, no `NEXT_PUBLIC_` prefix) and is never sent to the browser — this is deliberate: unlike some other providers, Anthropic's API refuses direct browser calls by default because a client-exposed key lets anyone burn arbitrary spend on the account, and this app has no login (only `noindex`).

- `GET /api/analyze` returns `{ configured: boolean }` so the client can show/hide the analysis UI without ever seeing the key itself.
- `POST /api/analyze` accepts `multipart/form-data` (`instruction` + one or more `files`), converts each file to an Anthropic content block (PDF → `document`, images → `image`, text/md/csv/json → inline `text`), and calls `client.messages.create` with the `MODEL` constant (`src/app/api/analyze/route.ts`, currently `claude-opus-5`). Unsupported file types (e.g. `.docx`, video) are rejected with a 400 — Claude's Messages API doesn't accept them the way Gemini's `inlineData` did, so `ConstraintValidatorTab`'s accepted-file list was narrowed accordingly.

`ConstraintValidatorTab.tsx` is the only consumer: it checks `/api/analyze` (GET) on mount to enable/disable the Analyze button, then POSTs the selected files as `FormData` on submit.

### Test Coverage

The `vitest` test runner is configured (`npm test`, config in `vitest.config.ts`, `environment: 'jsdom'`). Current and candidate coverage:

| Module | Testable surface | Status |
|--------|-----------------|--------|
| `src/lib/biometrics.ts` | `isValidDay()`, `parseTrendPayload()`, `summarize()`, `clamp()`, `avg()` | Covered — see `src/lib/biometrics.test.ts` |
| `src/lib/codexSearch.ts` | `rankEntries()` | Exported, pure, no test file yet — good next candidate (search-ranking spike for feature #2) |
| `src/lib/strategicDelta.ts` | `assembleDeltaContext()`, `routeSituation()`, `generateCandidates()`, `inhibit()`, `selectStrategicDelta()`, `predictStrategicDelta()`, `summarizeEvidence()` | Covered — see `src/lib/strategicDelta.test.ts` (engine) and `src/components/StrategicDelta.test.tsx` (UI states) |

Only list functions here that are actually `export`ed from their module — an AI assistant generating tests against an unexported symbol will fail on the import before it ever reaches the assertion.

Server-side, `/api/analyze` verifies the caller's JWT with `@supabase/server/core`'s `verifyAuth(req, { auth: 'user' })` — cryptographic verification against the project's JWKS instead of a round-trip to the Auth API. None of the three server-only Supabase env vars are actually mandatory for this route (`src/app/api/analyze/route.ts`): it resolves the project URL from `SUPABASE_URL`, falling back to the already-public `NEXT_PUBLIC_SUPABASE_URL` when that's unset; it never reads `SUPABASE_PUBLISHABLE_KEY` at all (that variable only matters for `auth: 'publishable'`, a mode this route doesn't use); and when neither `SUPABASE_JWKS` nor `SUPABASE_JWKS_URL` is set, the route derives the HTTPS JWKS endpoint itself from whichever URL it resolved (`<url>/auth/v1/.well-known/jwks.json`, rejecting anything that isn't a bare `https:` URL). In practice `/api/analyze` can authenticate against the same `pkydkbuodikttfeawqsw` project as the browser client above with zero server-only Supabase env vars configured. `SUPABASE_URL`, `SUPABASE_JWKS`, and `SUPABASE_JWKS_URL` (all non-secret; see `.env.local.example`) remain available as explicit overrides for pointing the route somewhere the public URL doesn't cover. No route currently needs `createAdminClient`/`auth: 'secret'`, so `SUPABASE_SECRET_KEY` is intentionally unset — add it only when a route needs to bypass RLS.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

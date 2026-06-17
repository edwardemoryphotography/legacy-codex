# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build — runs tsc + ESLint before emitting
npm run start    # Serve the production build locally
npm run lint     # ESLint via next lint
```

No test runner is installed. Type-checking happens only during `npm run build`. To check types in isolation without a full build, run `npx tsc --noEmit`.

**Config file note:** Next.js 14.2.5 does not support `next.config.ts`. The project uses `next.config.mjs`. Do not create a `next.config.ts`.

## Architecture

### Entry point and tab system

`src/app/page.tsx` is a server component that simply renders `<CodexApp />`. All real logic lives in `src/components/CodexApp.tsx`, a `'use client'` component.

`CodexApp` owns a single piece of state: `activeTab: TabId`. It renders a fixed/sticky `<nav role="tablist">` with 8 tab buttons (added Controls for neuro UX) and conditionally mounts the matching tab component. Tabs are fully independent — they share no state with each other or with `CodexApp`. Adding a tab requires: (1) adding a `TabId` (now includes controls) in `src/types/index.ts`, (2) adding an entry to the `TABS` array in `CodexApp.tsx`, and (3) creating the tab component and wiring it in the conditional render block.

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

### Deployment

All routes are prerendered as static content (`○` in build output). The layout sets `robots: noindex, nofollow` — this is a private operational dashboard. It deploys correctly to Vercel, Netlify, or any static host without additional configuration. There is no API route, no server action, and no runtime server dependency.

No Gemini API integration currently exists in the codebase. The natural integration point would be a bridge script (outside this repo) that calls the Gemini API and writes the result to `public/notes/biometric-trends.json` or a similar file consumed by a tab component.

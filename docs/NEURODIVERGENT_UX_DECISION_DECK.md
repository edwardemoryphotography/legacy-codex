# Legacy Codex — Neurodivergent UX Decision Deck
**Date:** 2026-06-16 | **Owner:** Edward Frye (neurodivergent founder, dual photo + systems practice) | **Success:** Commit to first direction this week, no endless exploration.

## Current State (Ground Truth)
- Static Next.js 14.2.5 dashboard, client-only, localStorage state (via SSR-safe useLocalStorage hook).
- 7 tabs: Overview (principles + validation metrics with PASS/FAIL toggles + stats), Protocols, Sprint Linker, Resumption Log, Biometrics (strict real-data only from /notes/biometric-trends.json; computes readiness + execution modes: deep_build, creative_edit, admin_light, recovery), Constraint Validator, Codex (hierarchical MD knowledge graph, 9 sections incl. neuro/artistic/business/personalos/root; client search, bookmarks, recents, deep links, copy/download).
- Dark-only, calm palette (teal/amber accents, subtle gradients/grid, good focus rings, partial prefers-reduced-motion support in globals.css).
- Explicit in Codex: "I am a neurodivergent founder. My mind works differently — this is the source, not the obstacle."
- Strengths: honest empty states (biometrics), externalization (resumption/sprint/codex search/bookmarks), chunked cards, direct operational copy, local privacy, fast static deploys (Vercel/Netlify).
- Gaps for neurodivergence: no user customization (density, scale, contrast, motion), no global quick capture/inbox, biometrics powerful but not yet driving UI or surface across tabs, tabs (7) + content can still overwhelm on low-energy days, limited visual/spatial views beyond basic cards/charts.
- Workflow constraints: fast context-switching (photo shoots ↔ coding/AI), energy/focus variability, privacy-first/local data, technically fluent (build is type gate, no tests), dual life needs (artistic craft + business ops + personal OS + neuro data), must be verifiable quickly.

## Research: Neurodivergent-Friendly UX Patterns (Synthesized)
Sourced from Welcoming Web, AccessibilityChecker, DevQube, UX Collective, ADHD PKM discussions, Obsidian ADHD workflows, Tiimo sensory notes, dashboard benchmarking.

**Core Patterns (prioritized for this dashboard):**
1. **Reduce Cognitive Load** — Chunked cards/sections, progressive disclosure, clear hierarchy, bite-sized text, plain/direct language (current copy excels here). Avoid dense layouts, jargon, long paragraphs. WCAG 2.4.6, 3.2.3, 3.3.2.
2. **Consistent + Predictable Navigation & Landmarks** — Fixed tablist, semantic roles, same position always, visible context (current tabs + TAB_META descriptions strong base). Add persistent signals (current mode, recent captures).
3. **Minimize Distractions & Sensory Management** — Calm dark palette (current good), no auto animations/loops, respect reduced-motion (partial), user controls for density/spaciousness, font scale, contrast, accent strength. Muted colors over neon.
4. **Visual Structure & Spatial Thinking** — Color-coded sections (Codex already has per-section tones/emojis), cards, stats, simple timelines/charts, Kanban or grid views for planning/knowledge. Supports ADHD spatial strengths + autism predictability.
5. **Energy/Focus Awareness & Externalization** — Biometrics governor is a killer feature (readiness formula + named modes mapped to work types). Extend to drive suggestions, highlights, or simplified UI states. Quick capture, resumption, search, bookmarks/recents to offload working memory/executive function.
6. **Customizable + Forgiving Interfaces** — Local-first persistence (already everywhere), easy undo/reverse (toggles), presets ("Deep Work", "Scan/Admin", "Creative Flow"), export everything. Curb-cut: benefits tired/neurotypical users too.
7. **Keyboard-First + Immediate Feedback** — Shortcuts (⌘K hinted), visible focus, instant local updates, clear microcopy with specific actions ("Mark PASS", not vague).
8. **Literal, Direct, Low-Ambiguity Microcopy + Feedback** — Current style is near-perfect for autism/ADHD (operational, no fluff, explicit empty states).

**Impact Notes:** These reduce overwhelm, support variable energy (time blindness, executive dysfunction), amplify strengths (hyperfocus on linked knowledge, visual patterns). "Curb-cut effect": simpler = better for everyone.

## Comparable Tools & Design Patterns
- **Obsidian (top comparator for Codex + neurodivergent community):** Local-first MD files, bidirectional links, graph view, daily notes, Dataview queries for dynamic "dashboards" (client filters/search here mirror), Canvas for spatial, plugins for tasks/calendar (here tabs like Sprint/Resumption/Log). ADHD workflows: quick capture → inbox → clarify/organize (PARA-like via sections), graph for connections, low-friction writing. Pros: privacy, speed, "hacker fun", visual, flexible without cloud. Cons: customization rabbit holes (we control via curated dashboard). Fits perfectly — our Codex + search + bookmarks is a constrained, dashboard-shaped Obsidian.
- **Anytype / Capacities / Logseq:** Local-first, object/relation or outliner models (our hierarchical Codex entries close), privacy/E2E, graph. Less overwhelm than Notion.
- **Notion:** Multiple views of same data (ADHD win), templates, databases. But: overwhelm from infinite customization, cloud/privacy mismatch, rabbit holes. Avoid as primary shape.
- **Tiimo / Sunsama / xTiles:** Visual timelines/planning for time blindness, widgets/home-like (Overview as control room), sensory-friendly, forgiving. Good for planning tabs.
- **Dashboard patterns (general):** Clean card grids, contextual data overlays (biometrics + principles), honest states, instant feedback, progressive detail. Our current cards + badges + stats align.
- **Other:** Brain Dump (minimal capture), Todoist (tasks externalized).

**Key Lesson:** Obsidian-style local, visual, queryable, capture-first wins for neurodivergent PKM/dashboards. Notion-style freeform loses. Prioritize local + customization + externalization + energy awareness.

## Ranked Options vs. Your Constraints
Scored 1-5 on: Static/Next fit (client-only, no heavy deps), Local/privacy, Dual workflow support (photo/AI/neuro), Fast dev/verify (build gate), Neurodivergent impact (energy, load, externalize, sensory), Low scope for first commit.

| Rank | Option | Static Fit | Local/Privacy | Dual Workflow | Fast Dev | Neuro Impact | Effort (first) | Recommendation |
|------|--------|------------|---------------|---------------|----------|--------------|----------------|---------------|
| 1 | Energy-Aware Adaptive + Sensory Customization (Controls/Governor) | 5 (CSS vars + LS + effects) | 5 | 5 (modes map to artistic/deep_build etc.) | 5 (1-2 days, pure client) | 5 (biometrics leverage + prefs for variability) | Low (add tab/panel, LS, simple effects) | **START HERE** |
| 2 | Quick Capture + Inbox Layer (global or per-tab) | 5 | 5 | 5 (client ideas, code notes, shoot thoughts) | 4 (data model + integration) | 5 (exec function offload, context loss prevention) | Low-Med | Strong #2; combine with 1 |
| 3 | Visual/Spatial Multi-Views (Codex grids + Kanban for sprints/resumption + light graph) | 4 (pure React/SVG ok, avoid heavy libs) | 5 | 4 (artistic visual + planning) | 3 (more UI code) | 4 (spatial thinkers) | Med | Good follow-on |
| 4 | Command Palette / Global Keyboard (fuzzy across all + actions) | 5 | 5 | 4 | 4 | 4 (power + low-friction) | Low | Nice to have early |
| 5 | Full Obsidian-style PKM Emulation (dedicated daily notes, full graph viz, more sections) | 3 (static limits live plugins) | 5 | 5 | 2 (scope creep risk) | 5 | High | Later; current Codex + tabs already deliver core |

**Why #1 first:** Directly builds on your strongest existing asset (Biometrics governor + neuro section + explicit neurodivergent identity). Delivers immediate daily value for energy management + customization without refactoring tabs or data model. Fits all constraints perfectly. Prevents endless exploration by giving a small, verifiable shippable piece (new Controls tab + working prefs/capture) that shapes everything else.

## Recommended First Build: "Governor Controls" (Sensory + Energy + Capture)
**Scope:** Contained addition (new tab + minimal global wiring). Verifiable in <1 day dev + build. Commit direction: shape future tabs around adaptive calm UI, persistent capture, biometrics as governor.

**Spec (actionable for this week):**
- **New Tab: "Controls" (id: 'controls', glyph: '◍', tone: 'teal')** — add to TABS, TAB_META, types, conditional render in CodexApp. Self-contained demo + global LS.
- **Sensory Prefs (working):**
  - Density: 'compact' | 'comfortable' (affects preview padding/spacing in tab; persist; note for global card padding later).
  - Font scale: 0.9–1.3 (slider or steps; applies live to preview text + set CSS var --nd-font-scale on :root for future).
  - High contrast: toggle (stronger borders/text; preview + var).
  - Reduced motion: toggle (force no animations; preview + document).
  - Presets: buttons "Deep Focus" (compact, 1.0, reduced), "Scan Mode" (comfortable, 1.1), "Creative Flow" (comfortable, 1.15, high contrast off). Apply instantly.
  - All via useLocalStorage, simple UI with existing Input/Select/ActionBtn/Card/Badge/Section primitives.
- **Biometrics Mode Surface (leverage existing):**
  - Fetch or display summary from /notes/biometric-trends.json (reuse logic or simple fetch).
  - Show current readiness + mode (or manual override dropdown matching BiometricMode).
  - Recommendation text: e.g. "Deep build mode active — surface automation + neuro sections in Codex."
  - Visual: badges per mode, color accent preview.
- **Quick Capture + Inbox (externalization core):**
  - Prominent Input + ActionBtn "Capture" (top of tab or always-visible hint).
  - Saves {id, text, timestamp, suggestedSection?} to LS key 'nd-inbox'.
  - List recent 5 captures (scrollable, compact).
  - Per-item actions: Copy, "Log to Resumption" (append note to existing LS if possible, or stub), "Suggest to Codex" (copy title + link to clipboard for manual add), Delete.
  - "Export Inbox" button (JSON download).
  - Bonus: In Overview or global, surface last capture (future).
- **Global Wiring (minimal, in CodexApp):**
  - Load prefs on mount, useEffect to set document.documentElement.style.setProperty('--nd-font-scale', String(prefs.fontScale)); data-density etc.
  - Add a persistent mini-bar or integrate capture hint (e.g. top of content area: "Quick capture (demo in Controls)" + button to jump tab or modal simple).
  - Current mode badge in nav or Overview (manual for now).
- **Examples (in deck + live):**
  - Preset "Deep Focus": compact cards, lower scale, calm teal, reduced motion — ideal for coding sprints or deep photo edits.
  - Capture flow: type "Client X lighting notes + framing guide", capture → see in list → "Suggest to Codex" (artistic section) or "to Resumption".
  - Mode: low readiness → "Recovery: protect creative time, use admin_light tab first."
- **Data:** Enhance public/notes/biometric-trends.json with 5-7 varied sample days to demo modes/readiness.
- **No new deps.** Reuse everything. Update CLAUDE.md lightly.

**Tradeoffs:**
- Pros: Immediate neuro value (custom energy support + capture prevents loss), builds directly on biometrics/Codex strengths, zero privacy hit, fast to ship/verify (build + manual test), shapes all future work (tabs will respect prefs), low risk (new tab, backward compat).
- Cons: Prefs initially strongest in Controls tab (full global styling requires follow-up CSS var usage in cards/tabs — plan 2nd pass); capture is tab-local until lifted (still useful standalone); adds 8th tab (mitigate with future collapse or priority nav).
- Risks: Scope creep into full theme engine — constrain to 4 prefs + 1 capture. Over-adaptation: keep manual override always.
- Alternatives considered: Pure modal settings (less discoverable); full rewrite of nav (too big for first).

**Why this commits direction:** After this, every tab addition/enhancement asks "does it respect prefs? surface mode? feed capture?" Stops endless research. Next logical: apply density/scale to Overview/Codex cards, integrate capture into Resumption/Sprint, make biometrics drive tab highlights or filtered Codex views, visual Kanban in planning tabs.

**Verification Success Criteria (this week):**
- New Controls tab appears, prefs persist across reloads, live preview updates.
- Capture works, list populates, exports.
- Sample biometrics loads, modes compute.
- `npm run build` clean (tsc + lint pass).
- Can use daily: set "Deep Focus" preset, capture 3 thoughts, see mode rec.

## Implementation Sketch (for immediate build)
(See code changes below; full in repo.)

**Types addition (src/types/index.ts):**
```ts
export interface UIPrefs {
  density: 'compact' | 'comfortable'
  fontScale: number
  highContrast: boolean
  reducedMotion: boolean
}
export type TabId = ... | 'controls'
```

**CodexApp updates:** Add import ControlsTab, TABS push, TAB_META, conditional render, prefs LS + wiring effects, optional mini capture surface.

**New file:** src/components/tabs/ControlsTab.tsx (full working component using ui primitives + LS + fetch for bio).

**Sample data:** public/notes/biometric-trends.json with realistic varied days.

**Globals tweak (minimal):** Add :root { --nd-font-scale: 1; } and example usage notes.

**Build & test:** Run build; open in browser, exercise tab, reload, check LS in devtools.

## Next After This Build (post-commit)
- Lift prefs to affect main tabs (card padding via data attr + CSS).
- Biometrics-driven: e.g. in Codex, default filter to neuro/artistic on creative mode.
- Capture integration: ResumptionLog reads inbox or one-click.
- Visual: simple section cards or timeline in Overview.
- Review in 1 week: does it reduce load on low days? Adjust.

This deck is the artifact. Build the Controls starter now to prove it. Commit the direction: neurodivergent UX = calm customizable energy-governed externalization, Obsidian-inspired but dashboard-constrained, local-static.

**Sources (key):** Welcoming Web (ADHD UX patterns), AccessibilityChecker (cognitive accessibility principles), DevQube (7 neurodiversity principles), ADHD PKM Substack/Reddit/Obsidian forums (tool comparisons), current codebase (CLAUDE.md + tabs).

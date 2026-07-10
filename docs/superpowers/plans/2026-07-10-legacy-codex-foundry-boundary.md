# Legacy Codex and Foundry Console Boundary Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved Legacy Codex and Foundry Console product boundary enforceable without rewriting the frozen production interface.

**Architecture:** Preserve the current applications while adding one machine-readable ownership registry, tests that reject ambiguous ownership, a grounded schema inventory, and a current-to-target route map. UI and database migrations remain blocked until these artifacts are reviewed.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Vitest 4, Next.js 15 Foundry sub-application, Supabase, Convex, Markdown documentation.

## Global Constraints

- Legacy Codex is the personal cognitive operating system.
- Foundry Console is the technical builder and operations environment.
- Do not merge both products into one dashboard.
- Do not rewrite the frozen production application during this plan.
- Do not change a database schema during this plan.
- Inspect actual repository files before documenting ownership or schema state.
- Real data only; no mock, synthetic, or simulated project state.
- Root verification commands are `npm test`, `npm run lint`, and `npm run build`.
- Foundry verification commands are `npm run lint` and `npm run build` from `foundry-console/`.

---

## File structure

**Create:**

- `src/config/product-boundary.ts` — machine-readable ownership and allowed-job registry.
- `src/config/product-boundary.test.ts` — enforcement tests for unique IDs and valid owners.
- `docs/architecture/SCHEMA_INVENTORY.md` — current Supabase and Convex data ownership, with source paths.
- `docs/architecture/ROUTE_MAP.md` — existing route/tab to target-product mapping.

**Read but do not modify:**

- `src/components/CodexApp.tsx`
- `src/components/tabs/ControlsTab.tsx`
- `foundry-console/SCHEMA.sql`
- `pocketforge/convex/convex/schema.ts`
- `foundry-console/app/**`
- `src/components/tabs/**`

**Existing canonical inputs:**

- `docs/architecture/PRODUCT_BOUNDARY.md`
- `docs/architecture/FEATURE_PLACEMENT.md`
- `STATE.md`

---

### Task 1: Add the machine-readable ownership registry

**Files:**

- Create: `src/config/product-boundary.ts`
- Test: `src/config/product-boundary.test.ts`

**Interfaces:**

- Produces: `ProductOwner`, `FeaturePlacement`, `FEATURE_PLACEMENTS`, `isValidOwner(owner)`.
- Consumed by: Task 2 tests and later route/schema migration work.

- [ ] **Step 1: Write the failing test**

Create `src/config/product-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FEATURE_PLACEMENTS,
  isValidOwner,
} from './product-boundary'

describe('product boundary registry', () => {
  it('uses only approved owner values', () => {
    for (const feature of FEATURE_PLACEMENTS) {
      expect(isValidOwner(feature.owner)).toBe(true)
    }
  })

  it('contains no duplicate feature ids', () => {
    const ids = FEATURE_PLACEMENTS.map(feature => feature.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('assigns capture to Legacy Codex', () => {
    expect(FEATURE_PLACEMENTS.find(feature => feature.id === 'capture')?.owner)
      .toBe('legacy')
  })

  it('assigns deployment diagnostics to Foundry Console', () => {
    expect(FEATURE_PLACEMENTS.find(feature => feature.id === 'deployment-diagnostics')?.owner)
      .toBe('foundry')
  })

  it('assigns project identity to the shared layer', () => {
    expect(FEATURE_PLACEMENTS.find(feature => feature.id === 'project-identity')?.owner)
      .toBe('shared')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/config/product-boundary.test.ts --run
```

Expected: FAIL because `src/config/product-boundary.ts` does not exist.

- [ ] **Step 3: Add the minimal registry**

Create `src/config/product-boundary.ts`:

```ts
export type ProductOwner =
  | 'legacy'
  | 'foundry'
  | 'shared'
  | 'experiment'
  | 'archive'

export interface FeaturePlacement {
  id: string
  label: string
  owner: ProductOwner
  primaryJob: string
}

const VALID_OWNERS: readonly ProductOwner[] = [
  'legacy',
  'foundry',
  'shared',
  'experiment',
  'archive',
]

export function isValidOwner(owner: string): owner is ProductOwner {
  return VALID_OWNERS.includes(owner as ProductOwner)
}

export const FEATURE_PLACEMENTS: readonly FeaturePlacement[] = [
  {
    id: 'today',
    label: 'Today',
    owner: 'legacy',
    primaryJob: 'Surface energy, intention, blocker, and one next action.',
  },
  {
    id: 'capture',
    label: 'Capture',
    owner: 'legacy',
    primaryJob: 'Preserve thoughts with minimal friction.',
  },
  {
    id: 'resume-memory',
    label: 'Resume Memory',
    owner: 'legacy',
    primaryJob: 'Restore context between work sessions.',
  },
  {
    id: 'cognitive-profile',
    label: 'Cognitive Profile',
    owner: 'shared',
    primaryJob: 'Provide durable personalization primarily expressed through Legacy Codex.',
  },
  {
    id: 'project-identity',
    label: 'Project Identity',
    owner: 'shared',
    primaryJob: 'Provide one stable project id to both product representations.',
  },
  {
    id: 'systems-registry',
    label: 'Systems Registry',
    owner: 'foundry',
    primaryJob: 'Register applications, repositories, services, and modules.',
  },
  {
    id: 'deployment-diagnostics',
    label: 'Deployment Diagnostics',
    owner: 'foundry',
    primaryJob: 'Inspect builds, environments, deployments, and failures.',
  },
  {
    id: 'pocketforge',
    label: 'PocketForge',
    owner: 'foundry',
    primaryJob: 'Build and iterate applications from a mobile surface.',
  },
  {
    id: 'cognition',
    label: 'Cognition',
    owner: 'legacy',
    primaryJob: 'Visualize cognitive patterns that support a decision or action.',
  },
  {
    id: 'semantic-starfield',
    label: 'Semantic Starfield',
    owner: 'legacy',
    primaryJob: 'Reveal memory relationships for retrieval and dependency discovery.',
  },
] as const
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- src/config/product-boundary.test.ts --run
```

Expected: PASS with 5 passing tests.

- [ ] **Step 5: Run the full root test suite**

Run:

```bash
npm test -- --run
```

Expected: PASS with zero failed tests.

- [ ] **Step 6: Commit**

```bash
git add src/config/product-boundary.ts src/config/product-boundary.test.ts
git commit -m "test: enforce canonical product ownership"
```

---

### Task 2: Inventory the current data schemas without changing them

**Files:**

- Create: `docs/architecture/SCHEMA_INVENTORY.md`
- Read: `foundry-console/SCHEMA.sql`
- Read: `pocketforge/convex/convex/schema.ts`
- Read: `src/components/tabs/ControlsTab.tsx`

**Interfaces:**

- Produces: a table for every observed table/collection with source path, current consumer, candidate owner, and migration risk.
- Consumed by: future shared-project-contract and data-migration plans.

- [ ] **Step 1: Extract Foundry SQL objects**

Run:

```bash
grep -Ein "create table|create policy|alter table" foundry-console/SCHEMA.sql
```

Expected: line-numbered SQL definitions and policies from the real Foundry schema.

- [ ] **Step 2: Extract PocketForge Convex collections**

Run:

```bash
grep -En "defineTable|defineSchema" pocketforge/convex/convex/schema.ts
```

Expected: line-numbered Convex schema declarations.

- [ ] **Step 3: Extract root Supabase table references**

Run:

```bash
grep -Rno "\.from('[^']*'" src | sort -u
```

Expected: all Supabase `.from()` references currently used by the root app, including `nd_prefs` and `nd_captures` if they remain present.

- [ ] **Step 4: Write the inventory**

Create `docs/architecture/SCHEMA_INVENTORY.md` with this exact structure:

```md
# Current Schema Inventory

**Status:** Observed repository state; no migration authorized.
**Reviewed sources:** `foundry-console/SCHEMA.sql`, `pocketforge/convex/convex/schema.ts`, and root `.from()` references under `src/`.

| Record | Source | Current consumer | Candidate owner | Migration risk |
|---|---|---|---|---|

## Ownership rules

- Cognitive state belongs to Legacy Codex.
- Build, deployment, integration, and audit state belongs to Foundry Console.
- Stable identity and cross-product source links belong to Shared.
- No table is renamed, moved, or deleted until every current reader and writer is documented.

## Unresolved conflicts

List only conflicts demonstrated by the repository. Include exact file paths for every conflicting reader or writer.
```

Populate the table only from the command output. Do not infer missing tables or fields.

- [ ] **Step 5: Verify every documented record has a source path**

Run:

```bash
grep -n "|" docs/architecture/SCHEMA_INVENTORY.md
```

Expected: each inventory row contains a repository source path and no placeholder values.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/SCHEMA_INVENTORY.md
git commit -m "docs: inventory current data ownership"
```

---

### Task 3: Create the current-to-target route map

**Files:**

- Create: `docs/architecture/ROUTE_MAP.md`
- Read: `src/components/CodexApp.tsx`
- Read: `foundry-console/app/**/page.tsx`

**Interfaces:**

- Produces: a reviewable route and tab migration map.
- Consumed by: later navigation and component-extraction work.

- [ ] **Step 1: Extract current Legacy tabs**

Run:

```bash
grep -n "id: '" src/components/CodexApp.tsx
```

Expected: the current tab ids and labels from the `TABS` array.

- [ ] **Step 2: Extract current Foundry pages**

Run:

```bash
find foundry-console/app -name page.tsx -print | sort
```

Expected: one path for every current Foundry route.

- [ ] **Step 3: Write the route map**

Create `docs/architecture/ROUTE_MAP.md` with these columns:

```md
# Current-to-Target Route Map

| Current path or tab | Current product | Target product | Target surface | Action | Dependency |
|---|---|---|---|---|---|
```

Use only the actions `keep`, `rename`, `move`, `split`, `demote`, or `archive`.

The first required rows are:

```md
| `overview` | Legacy root | Legacy | Today | rename | next-action contract |
| `resumption-log` | Legacy root | Legacy | Memory / Resume | keep | memory contract |
| `controls` capture section | Legacy root | Legacy | Capture | move | capture persistence inventory |
| `controls` sync diagnostics | Legacy root | Foundry | Integrations / Diagnostics | split | schema inventory |
| `/dashboard/friction` | Foundry | Legacy | Review / Memory | move | shared project identity |
| `/dashboard/events` | Foundry | Foundry | Audit / Diagnostics | keep | none |
```

Add the remaining rows from the actual extraction output.

- [ ] **Step 4: Verify that every current tab and page is represented**

Run:

```bash
python - <<'PY'
from pathlib import Path
route_map = Path('docs/architecture/ROUTE_MAP.md').read_text()
required = [
    'overview', 'protocols', 'sprint-linker', 'resumption-log',
    'biometrics', 'constraint-validator', 'codex', 'controls',
]
missing = [name for name in required if name not in route_map]
if missing:
    raise SystemExit(f'Missing Legacy tabs: {missing}')
print('All Legacy tabs are represented.')
PY
```

Expected: `All Legacy tabs are represented.`

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/ROUTE_MAP.md
git commit -m "docs: map current routes to canonical products"
```

---

### Task 4: Verify the freeze boundary and documentation consistency

**Files:**

- Verify: `docs/architecture/PRODUCT_BOUNDARY.md`
- Verify: `docs/architecture/FEATURE_PLACEMENT.md`
- Verify: `docs/architecture/SCHEMA_INVENTORY.md`
- Verify: `docs/architecture/ROUTE_MAP.md`
- Verify: `STATE.md`

**Interfaces:**

- Produces: evidence that documentation agrees and no production UI code was changed.

- [ ] **Step 1: Confirm canonical definitions are present**

Run:

```bash
grep -Rni "personal cognitive operating system" docs/architecture STATE.md
grep -Rni "technical builder and operations" docs/architecture STATE.md
```

Expected: both definitions appear in the canonical docs and project state record.

- [ ] **Step 2: Confirm the freeze is preserved**

Run:

```bash
git diff --name-only main...HEAD | grep -E '^src/components/|^foundry-console/app/' && exit 1 || true
```

Expected: no output and exit code 0.

- [ ] **Step 3: Run root verification**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Run Foundry verification**

Run:

```bash
cd foundry-console
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 5: Review changed files**

Run:

```bash
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected: only approved documentation, registry, and test files; `git diff --check` produces no output.

- [ ] **Step 6: Commit any verification-only corrections**

```bash
git add docs src/config STATE.md foundry-console/README.md pocketforge/README.md
git commit -m "docs: finalize canonical product boundary" || true
```

---

## Completion criteria

The phase is complete only when:

1. The canonical definition and feature registry are present.
2. The machine-readable registry tests pass.
3. Every current database object has a source-backed inventory entry.
4. Every current Legacy tab and Foundry route has a target placement.
5. No frozen production UI file changed.
6. Root tests, lint, and build pass.
7. Foundry lint and build pass.
8. The pull request clearly states that UI and schema migration remain future work.

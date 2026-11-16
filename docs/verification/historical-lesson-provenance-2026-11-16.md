# Historical lesson provenance repair — November 16, 2026

## Source and baseline

The defect is recorded in [PR #192's review](https://github.com/edwardemoryphotography/legacy-codex/pull/192#discussion_r4559482449).
Inspection fetched origin/main at `c59bf59131565f5b960ffba118fb6e63b56e4c69`,
the merge of [PR #194](https://github.com/edwardemoryphotography/legacy-codex/pull/194).
That repair already separated `missionId` (ledger association) from
`originMissionId` (known Project Review origin), removed historical anchors
from origin retrieval/labels, and guarded bridge validation and transfer measurement.

The remaining hole was the reload default: absence of a stored `origin` was
treated as proof of Project Review provenance. Missing provenance must be unknown.
The existing Project Review writer has used `lesson:confirm:<sha256>` since its
introduction in commit `668353e`; incident, casebook and Relay use distinct keys.
The key is workflow provenance, not evidence that the lesson is true or useful.

## Trace and ownership

1. Mission's historical selector shows actual checked-in casebook material, its
   restrictions, proposed rule, application conditions and exceptions. An owner
   chooses a mission for accounting and explicitly confirms.
2. `/api/delta-lessons` freezes server-side source references and stores the
   decision in the existing transitional `mission_events` ledger, with
   `origin: casebook` and a candidate decision key. No source mission is asserted.
3. Reload's `loadConfirmedLessons` preserves the row's mission association for
   scope/ownership/retirement. It now reads the existing idempotency key and
   recognizes Project Review provenance only from that workflow's exact key
   grammar, with an absent legacy marker or explicit `project_review` marker.
   Other/missing/unrecognized provenance produces a null origin. This applies
   to already-stored rows without migration, backfill or history rewrite.
4. Project Review derives origin-priority candidates only from known origins.
   Correction origins keep their separate retrieval. The four-project deep-read,
   50 recent-project, 20 outside-window origin, eight-summary and context budgets
   remain unchanged. An anchor can still qualify by independently relevant context.
5. Model-visible lessons retain full rule/conditions/exceptions/mechanism/scope
   and frozen source references. A mission association is emitted only as a
   mission-scoped rule's applicability. Unknown origins have no project provenance
   and cannot be a bridge's lessonSourceId or a measured cross-project application.
6. Brief, artifact analysis and task/operation assistance use the same scoped
   loader and learned-context formatter. The Project Review cache version moves
   from 9 to 10 so earlier origin assumptions cannot survive restoration.

New Project Review confirmations explicitly mark their workflow in existing JSON.
This adds no table, schema, authority, model call or user-facing surface.
The canonical Mission/Action/Evidence/Audit/Routing ownership contract is unchanged.
PR #193's light-mode tools repair is untouched.

## Regression evidence and limits

The previous PR's provenance test constructed fictional missions, confirmations,
a database double and model proposals. This repair replaces that file with
algorithm and source-contract checks using the actual checked-in casebook,
source references and the actual writer's source fingerprint. Corpus IDs and
era strings are document metadata used by the generic selection algorithm,
not mission rows. No user, confirmation, database row or product outcome is created.

- The current-main absent-origin classifier was extracted unchanged:
  missing-provenance checks failed before the repair; the repaired classifier passes.
- A deliberate local mutation restored the original association-as-origin
  assumption. The corpus-selection regression failed: BR-002 displaced BR-011
  from BR-006 / BR-010 / BR-011 / BR-013. The mutation was restored and all six
  provenance checks passed. This is a regression mutation, not a production event.
- Contracts cover legacy and explicit review keys, unknown/missing origins,
  casebook/incident/Relay exclusions, four-slot selection and genuine-priority
  ordering, original source restrictions and conditions, reload-time wiring,
  model-visible scope and downstream origin guards.

These checks establish algorithm and source contracts. They do not establish a
read of an actual stored historical confirmation, an authenticated owner review,
model reasoning quality or useful future transfer. Existing-record handling is
a read-time compatibility rule; no production records were altered to demonstrate it.
The broader existing suite includes older infrastructure doubles; passing that
suite does not turn them into real-use evidence.

## Release evidence

### Observed release — November 16, 2026, 13:09 Pacific

- [PR #195](https://github.com/edwardemoryphotography/legacy-codex/pull/195)
  merged at `374a15da49bcb04792a3f4639c95204d535ce5b1` after
  [hosted CI](https://github.com/edwardemoryphotography/legacy-codex/actions/runs/43955738017)
  passed every required repository gate and the automated review reported
  [no findings](https://github.com/edwardemoryphotography/legacy-codex/pull/195#issuecomment-6929210228).
  Merged-main [CI](https://github.com/edwardemoryphotography/legacy-codex/actions/runs/43956444514)
  also passed.
- Reviewed head `05042b362ca69172b25c58ec3bef117bfae551d8` and merged commit
  have identical Git trees: `369a2abdad24d3914d4c90ae763cf147c16c31ab`.
  The final diff was reviewed; the change touches only the provenance path,
  its regression file and release records. PR #193's CSS is unchanged.
- Canonical frontend [deployment](https://vercel.com/edwardemoryphotographys-projects/frontend/CgwggdWrWFnCenxciHrmxqW7sVHz)
  `dpl_CgwggdWrWFnCenxciHrmxqW7sVHz` is READY Production at the exact
  merged SHA. Both canonical-hostname deployment lookup and alias lookup
  mapped `legacy-codex.vercel.app` to it; aliasError was null.
- After that mapping, non-writing HTTP checks at 21:09 UTC returned root 200,
  unsigned `/api/delta-lessons` GET 401 and unsigned
  `/api/delta-review?capabilities=1` GET 401. The deployment-scoped
  error/fatal query over the preceding ten minutes returned no groups.
  These are deployment/boundary observations, not an authenticated rule retrieval.
- Verdict: **SHIP WITH FLAGS**. Source/algorithm contracts and deployed commit
  identity are verified; historical confirmation, owner review and beneficial
  later transfer remain unverified. Documentation follow-through does not
  introduce additional application behavior.

### Observed local checks and production-data availability

Builder, immersive and Economy gates passed. Lint: zero errors, 22 existing
warnings. TypeScript passed; 672 tests passed with two opt-in source checks
skipped. Production build and whitespace checks passed. Initial local build
setup failed on an external dependency symlink and then on a stale dependency
copy; installing from the lockfile with npm ci resolved both without source or
configuration changes. Hosted CI validates the final lockfile installation.

A read-only aggregate query on production project pkydkbuodikttfeawqsw on
November 16 returned **0 confirmed lessons, 0 retirements, 0 saved reviews**.
Only counts were retrieved; no private lesson text or account identifier was
published. There is no stored confirmation available for a real-record replay.
This is a specific missing acceptance input, not evidence that the read path ran.

## Remaining real-use verification

Using a genuine owner-confirmed historical rule and a different real task,
inspect a later Project Review: its source references, conditions and exceptions
must survive; its ledger anchor must gain neither origin priority nor an origin
label. Any selected anchor must have an independent selection reason. Inspect
the resulting decision/outcome before claiming useful transfer. This repair
does not bulk-confirm history or claim that source retrieval itself is inheritance.

# Current Legacy Codex architecture companion

Open [index.html](index.html). This is the directly delivered Archify artifact—not a copied or post-edited wrapper. Keep `index.delivery.json` beside it to preserve strict provenance.

- Absolute HTML: `/Users/edwardfrye/Desktop/legacy-codex-brief-update/docs/visualizations/legacy-codex-origin/architecture/index.html`
- Relative to the origin visualization root: `architecture/index.html`
- Type: `architecture`; static default; English; showcase profile.
- Scope: the current checked-out human-intent / Strategic Delta correction loop, not ecosystem history or deployment topology.
- Composition: 8 numbered primary nodes, 4 supporting nodes, 14 relationships. Supporting roles are separate commitment, evidence, optional model review, and human-confirmed lessons.

## Source identity

- Origin, preserved exactly: `https://github.com/edwardemoryphotography/legacy-codex.git`
- HEAD: `18f8b68e80c3ac97a59497d28f3806cf8233129b`
- Branch: `feat/brief-tab`
- GitHub's commit API returned that exact SHA; this does not establish merge or deployment.
- Initial worktree status: untracked `docs/plans/`. Cited application sources were not modified.
- Archify validated 31 source references. All 10 distinct cited source files were additionally compared byte-for-byte with `git show <pinned-revision>:<path>` and matched. Source paths and inclusive inspected line ranges are embedded in `candidate.json` and the node source passports.

## Verified receipts

Current successful run is **review-3**, which restored the accepted candidate after the bounded placement experiment failed.

| Claim | Evidence |
|---|---|
| Showcase validation: 9/9, zero errors, zero warnings | [review-3/index.finalize.json](review-3/index.finalize.json) |
| All four gates pass: validate, deliver, strict check, browser-check | [review-3/index.finalize-summary.json](review-3/index.finalize-summary.json) |
| Current artifact provenance | [index.delivery.json](index.delivery.json) |
| Automated real Chrome measurements | [review-3/index.browser-check.json](review-3/index.browser-check.json) |
| Four captured desktop/theme images | [visual-check/index.visual-check.html](visual-check/index.visual-check.html) |
| Artifact-bound capture receipt | [visual-check/index.visual-check.json](visual-check/index.visual-check.json) |

Delivery receipt ID: `810dafb6-35dd-4c4d-ad03-a343c1629989`

```text
specification_sha256: 37de17cff7f3bc81d02bf869b3a5553d75251620f24913245cf1c3b6314b8122
artifact_sha256: 2586f50193cc79fdea9d3308ca33cf135e11eb60f08e16117a131b3fb802c038
browser_evidence: passed
visual_review: passed (desktop screenshots; caveats below)
```

Browser gate checked light theme at 1440×900, 1600×1000, 1920×1080, and 2048×1320, plus dark theme at the endpoints and READ/Still state. No horizontal overflow. The smaller viewport uses the declared readable document-scroll exception; it is not intended to fit the entire diagram above the fold.

## Visual inspection and bounded repairs

All four screenshots were inspected: dark and light at 1440×900 and 2048×1320. The numbered green path remains distinguishable from the optional purple and human-confirmation red branches. Nodes and labels remain inside the diagram; the compact lower row requires scrolling at the smaller endpoint. Source badges are visible. This is screenshot review, not a claim that every export or interactive control was manually exercised.

Two validation repairs compacted column placement to meet projected-text and label-gap checks. A later required placement-only review attempted to reduce return-route crossings; it failed on negative coordinates and was restored, then the complete finalizer passed again. The failed experiment's receipt remains in `review-2/`; it is not the delivery receipt.

Remaining advisory limitations: five **resolved crossovers**, chiefly on the ledger return, and two routes over the suggested bend count. There are zero improper crossings, ambiguous corridors, or label-clearance errors in the strict receipt. Small relationship text is within the browser's hard readability gate but below Archify's preferred 7.5px target at the smaller desktop view. Do not describe this as a crossing-free or mobile-reviewed composition.

## Interpretation boundaries

- A recommendation is not a commitment. Acceptance writes `delta_accepted`, not `actions`. `SavedActions.saveAction` is the separate human-triggered canonical commitment insert.
- A model self-check is not observed evidence. `evidence_snapshots` is read independently; no actions-to-evidence or model-to-evidence arrow has been invented.
- Confirmation and retirement are human UI operations. The lesson API checks the owner and current review, writes append-only events, and makes no model call. The reader excludes retirements by the exact confirmation ID and respects account/project scope.
- `mission_events` is the transitional UI ledger, not a new claim of generic canonical audit ownership or doctrine authority.
- “Context readers” groups the cooperating browser and review-server readers for overview readability. It is not one deployable service. Only the review-server context reads canonical commitments and confirmed lessons. “Backend” colors on the pure engine indicate logic, not additional remote services.
- Store-to-reader arrows mean returned data. Actual read call sites belong to MissionTab and the review server.
- The Brief route is a branch-local display-only feature outside this loop: `src/app/api/brief/route.ts:99–116` calls the provider and returns text; it does not write a Delta event. No claim is made that the branch is merged.
- Evidence ingestion, database contents, provider availability, production auth/RLS behavior, owner-session reasoning quality, and deployed status are unknown in this artifact. No production records, secrets, or model requests were accessed.

## Durable authoring lesson

Keep implementation authority distinctions in the topology and source passports: acceptance, explicit commitment, external evidence, and human-confirmed learning must never collapse into a single “AI completed it” edge. Archify's automated pass is separate from screenshot judgment, and a failed placement experiment must not supersede the verified artifact.

## Reproduce

From this directory (use a new evidence folder for any changed candidate):

```sh
node /Users/edwardfrye/.claude/skills/archify/bin/archify.mjs finalize architecture candidate.json index.html --repo-root /Users/edwardfrye/Desktop/legacy-codex-brief-update --quality showcase --out-dir next-review --json
```

No application code, parent visualization, plan, STATE document, Git commit, or deployment was changed by this companion task. All authored files are confined to this `architecture/` folder.

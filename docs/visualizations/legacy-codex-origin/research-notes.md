# Legacy Codex ecosystem: research notes

**As of:** 2026-10-02. **Method:** read-only local git plus authenticated `gh api` repository, commit, tree, contents, compare and pull-request responses. No application implementation or external writes.

## Reading this history

- The through-line is an existing vision becoming representable and inspectable, not software becoming sentient. The canonical Cookbook explicitly makes that distinction.[5]
- Earliest related precursor: **2025-03-21**, NeuroCreative. Earliest documented Codex origin: **November 2–3, 2025**, retrospectively reported on November 28. Earliest Codex git record: **2025-11-28**. Latest observed main implementation: **2026-10-02**.[1][4][7]
- `meaning` fields are evidence-bounded interpretation, not additional measured events. Domain membership is conceptual relevance; it does not assert a shared runtime, data flow or historical debut.
- `documented` is an account or declared baseline. `implemented` means source code exists at that revision. `branch` identifies the local-checkout view, including known merge status. None automatically means deployed, runtime verified or live.
- Dates normally follow git author dates. The origin uses the beginning of a documented two-day range. The grouped routing/Atlas milestone uses August 7 while naming August 4 contributions. The Brief snapshot uses the verified October 2 merge, not its retained October 1 author date.

## Repository inventory (observed remote default-main heads)

| Repository | Pinned revision | Role |
|---|---|---|
| [legacy-codex](https://github.com/edwardemoryphotography/legacy-codex) | `7f49d447b8d2b29a602b2aafdff43d525e1bfa7b` | Human-facing Legacy Codex application. Also contains foundry-console/ (builder/execution console) and PocketForge sub-app code. Revision is observed GitHub main; local feat/brief-tab remains at 18f8b68e80c3ac97a59497d28f3806cf8233129b. |
| [codex-control-panel](https://github.com/edwardemoryphotography/codex-control-panel) | `e56c3e209d6478c208ca2650d80a2da473f7bc79` | Task-routing Control Panel, shared Standards Kit and canonical cross-project STATE.md. Older dated state entries must not override newer scoped records. |
| [codex-system-architecture](https://github.com/edwardemoryphotography/codex-system-architecture) | `f571e466853f3832f2b1692ad9ae825a51794dc4` | Architecture/document navigation and System Atlas; canonical owner of notion-wiki/docs/GOOSE-COOKBOOK.md. First tracked snapshot is January 21, 2026, not the Cookbook debut. |
| [Artful-Intelligence](https://github.com/edwardemoryphotography/Artful-Intelligence) | `326afb3dd0423122c0a646ee1ab389f653fdf7f0` | Separate photography/creative-analysis implementation; related infrastructure explicitly named by the Cookbook. Not the unified hub. |
| [artful-intelligence-hub](https://github.com/edwardemoryphotography/artful-intelligence-hub) | `9a47a910ef7a523b1e0e6fd09b319d69234093e6` | Unified ecosystem status UI and truth-ladder surface; its README explicitly distinguishes implemented from runtime-verified integrations. |
| [rork-legacy-codex-companion](https://github.com/edwardemoryphotography/rork-legacy-codex-companion) | `d2d3d40b749d0b4c3d0e6da4f16bbe29c0cfc27d` | Historical Swift iOS companion; later Strategic Delta source explicitly cites conceptual next-action lineage. No live synchronization is inferred. |
| [neurocreative-platform](https://github.com/edwardemoryphotography/neurocreative-platform) | `c077bcdb94bdf3c8fa9079c9781be135c7e5b814` | Earlier EEG/creative-stack project, linked to Legacy Codex in later repository documentation. Related precursor, not evidence of a March 2025 Codex origin. |

The Architecture repository’s initial January 21 snapshot already contains document navigation and a knowledge-graph component; the Cookbook is a later August 9 addition, and System Atlas is an August 7 redesign. Those are distinct events, not dates inferred from today’s README.[39][23][27]

## Local branch versus remote main — important reconciliation

- Local checkout: `feat/brief-tab`, HEAD `18f8b68e80c3ac97a59497d28f3806cf8233129b`, 342 reachable commits. Local `git remote -v` resolves origin to the Legacy Codex repository above. The branch author timestamp is `2026-10-01T17:07:21Z`; committer timestamp is `2026-10-02T06:26:56Z`.[34]
- GitHub PR #98 is **closed and merged**, `merged_at: 2026-10-02T06:30:35Z`, squash commit `4ff74b8a93371d36a500bab71bac30973e72655a`.[36]
- GitHub main resolves to `7f49d447b8d2b29a602b2aafdff43d525e1bfa7b`, “Bring the Control Panel design and task routing into Mission (#97)”. The compare endpoint says `diverged`, main 5 ahead / 1 behind by commit identity. A squash explains why the old Brief SHA is not an ancestor while the feature is nevertheless merged.[37][40]
- Independent contents reads at branch and main returned identical blobs for `src/lib/dailyBrief.ts` (`c874f80e8adaf6cc922d5f626343279bbc07f1a6`) and `src/components/tabs/BriefTab.tsx` (`bfe92a06d1d2489675855fc4496f44fe7853e2f8`). This verifies those files match, not whole-tree equivalence. The local branch lacks the newer Mission routing integration.[34][37]

## Milestone evidence and interpretation

### 2025-03-21 · A neurocreative precursor
`neurocreative-baseline` · **documented** · domains: neuro

The NeuroCreative repository records a v0.1-mvp checkpoint focused on Python WebSocket EEG streaming, a simple viewer and Muse 2 compatibility through Mind Monitor. React and ML experiments were archived.[1][2][3]

**Interpretation:** A related technical lineage predates the documented Codex origin. Later cross-links connect the projects; this does not establish that Legacy Codex existed in March.

**Bounds:** Precursor lineage is an interpretation supported by later repository cross-links, not a documented March Codex integration. No live EEG stream or WHOOP connection was tested; the later README calls WHOOP integration planned/in progress.

### 2025-11-02 · A method for preserving intent
`codex-origin-session` · **documented** · domains: codex, doctrine

The November 28 README retrospectively attributes Legacy Codex to a November 2–3, 2025 session and describes a collaboration protocol, architecture, transmission framework and continuity blueprint.[4][5]

**Interpretation:** The early record already describes continuity and transmission. Later machinery can make that original purpose more legible without implying a newly invented ambition.

**Bounds:** The event spans November 2–3; November 2 is its start-date anchor, not an exact session timestamp. This is a later first-party account, not a contemporaneous transcript or git commit from November 2.

### 2025-11-26 · Creative analysis takes executable form
`artful-genesis` · **implemented** · domains: artful

Artful Intelligence has a dated Genesis commit containing a Python backend, pose-analysis engine and a Next.js frontend with an image uploader.[6][5]

**Interpretation:** This is a parallel creative-software strand later named within the Cookbook’s related infrastructure—not proof that the Codex runtime called it in 2025.

**Bounds:** Genesis is the earliest commit retrieved from this repository, not a proven date for the first creative idea or prototype. The historical implementation was inspected, not executed or evaluated for analytical validity.

### 2025-11-28 · The framework becomes a durable artifact
`codex-repository` · **implemented** · domains: codex, doctrine

The Legacy Codex repository begins with a README, expands its description of collaboration and continuity, and adds an index.html artifact that same day.[7][4][8]

**Interpretation:** The vision becomes a versioned object other people and future agents can revisit, rather than relying only on a conversation.

**Bounds:** The first commit is November 28; do not equate it with the earlier November 2–3 origin account. An uploaded HTML file establishes an artifact, not a verified deployment.

### 2026-02-23 · Foundry gives work an operating surface
`foundry-and-agent-continuity` · **implemented** · domains: codex, foundry, agents

The foundry-console subdirectory adds a Next.js console for Case Study Zero: workspaces, sprints, friction, milestones and audit events. A separate same-day agent skill records structured lessons through an explicitly invoked script.[9][10][11]

**Interpretation:** Execution state and reusable lessons gain concrete homes. Their shared theme is continuity; the sources do not show the lesson script operating the Foundry console.

**Bounds:** Foundry is a subdirectory in legacy-codex, not a separately verified repository. The skill name “self-improving” does not establish autonomous learning. Initial implementation date is not a live-backend verification date.

### 2026-03-13 · A mobile companion explores the same problem
`companion-intelligence` · **implemented** · domains: codex, reasoning

The Swift iOS companion adds an Intelligence tab, GitHub service and project-analysis views. Later Strategic Delta source comments explicitly identify the companion’s Daily Boot and project-next-action ladder as lineage.[12][13]

**Interpretation:** The same next-step problem appears in a separate mobile surface. The later web engine records conceptual lineage while deliberately avoiding a runtime dependency on the older surface.

**Bounds:** This establishes checked-in mobile code, not an App Store release or current mobile deployment. Lineage is explicitly claimed in later source commentary; no code-sharing or live synchronization is inferred.

### 2026-04-19 · Capacity signals must come from reality
`biometric-honesty` · **implemented** · domains: codex, neuro, evidence

After adding a biometric dashboard, Legacy Codex removes mock, fixture and fallback values. The biometric reader returns an explicit unavailable state when its external JSON source is missing or invalid.[14][15]

**Interpretation:** The neuro strand enters Codex as a real-data-only input contract: absent evidence must remain absent rather than becoming a convincing readiness score.

**Bounds:** The reader expects a live bridge; the code does not prove that a WHOOP, Muse or Apple Health bridge was running. No personal biometric observations are included in this history.

### 2026-05-15 · Control Panel names the routing question
`control-intake` · **implemented** · domains: control

The first substantive Control Panel screen offers task intake, intent chips and Route Task / Fast Execute Here buttons. At this revision those buttons only display alerts.[16][17]

**Interpretation:** Task-to-tool routing becomes an explicit interface concern before later persistence and provider integration. The first screen is not yet an execution engine.

**Bounds:** Do not backdate the current README’s AI routing, safeguards or Foundry persistence to this intake prototype.

### 2026-05-18 · A component-based front door
`codex-next-migration` · **implemented** · domains: codex

Legacy Codex’s Next.js migration introduces an application shell, typed Codex data and independent tabs for reference material, protocols, analysis, resumption and biometrics. It replaces the static site on main in the June 10 merge.[18][19][20]

**Interpretation:** The reference framework becomes a composable application surface while remaining distinct from the Foundry sub-application.

**Bounds:** May 18 is the implementation commit; June 10 is the main-branch merge. Neither date alone verifies production behavior. The February single-file restoration shows the path was not a simple uninterrupted migration.

### 2026-08-07 · Routes and relationships become inspectable
`routing-and-system-atlas` · **implemented** · domains: codex, foundry, control, evidence

By August 7, Foundry has a routing UI and Legacy Codex readout, Control Panel has a validated Foundry-persistence contract, and Architecture’s knowledge graph is redesigned as System Atlas with territories, connections and focus navigation.[21][22][23]

**Interpretation:** Task intent, execution state and architectural relationships become inspectable across distinct surfaces. This is a cluster of related implementations, not evidence that every repository shares one runtime.

**Bounds:** The routing implementations cited are dated August 4; August 7 anchors the Atlas endpoint of this grouped milestone. Commit evidence establishes code and contracts, not a fresh end-to-end production verification.

### 2026-08-09 · Intent gains a mission and evidence loop
`mission-loop` · **implemented** · domains: codex, missions, evidence

The August 8 Mission Loop commit adds lifecycle logic, schema and an evidence bridge. August 9 adds the Mission screen and unifies capture with evidence-bridge writes into Supabase.[24][25][26]

**Interpretation:** The human-facing next action can be related to a mission, its state and external evidence rather than only to an isolated task description.

**Bounds:** Dates distinguish the August 8 data/lifecycle foundation from the August 9 UI and capture work. Repository implementation is not proof of populated production missions or evidence.

### 2026-08-09 · The build becomes an explanation
`goose-doctrine` · **documented** · domains: doctrine, agents, reasoning

The Architecture repository adds the canonical Goose Cookbook. It explicitly frames the system as preserving meaning across representations and explains the reconstruction of an existing vision from implementation evidence.[27][5]

**Interpretation:** The important change is improved legibility of the original end-state—not software becoming sentient or the vision suddenly expanding. Lessons are to become durable capability rather than transcript accumulation.

**Bounds:** The pinned canonical file includes subsequent same-day revisions and an addendum internally dated August 10. Its git author date is August 9; those clocks are not silently reconciled. Doctrine states an operating method, not proof that every runtime model inherited it.

### 2026-08-10 · One hub, with an explicit truth ladder
`flock-hub` · **implemented** · domains: artful, foundry, evidence, doctrine

Artful Intelligence Hub adds a unified page wired to constellation_status. Its README distinguishes live UI and status reporting from migrations, owner auth, realtime and a command function that were only written or not exercised.[28][29]

**Interpretation:** A shared ecosystem view becomes possible without pretending every connected-looking capability is live. Artful Intelligence Hub is distinct from the photography-analysis repository.

**Bounds:** Live is a claim reported by the pinned README, not independently re-tested in this research. The same README explicitly leaves several integration rungs below Live; its age prevents assuming those statuses describe every later deployment.

### 2026-09-07 · One next move, with honest uncertainty
`strategic-delta` · **implemented** · domains: codex, missions, reasoning, evidence

Strategic Delta lands as the predictive front door. Its pure pipeline assembles context, routes the situation, generates candidates, inhibits unsuitable moves and selects a recommendation; absent context remains explicit.[30][13]

**Interpretation:** The earlier next-action idea becomes a bounded reasoning mechanism. A prediction remains separate from the person’s saved commitment and from verified evidence.

**Bounds:** This source establishes engine behavior and declared lineage, not autonomous planning quality for arbitrary ideas. A successful save/resume workflow is a separate verification claim from next-move quality.

### 2026-09-30 · Reasoning reads its sources
`context-reconstruction` · **implemented** · domains: codex, missions, reasoning, doctrine, evidence

Project review adds authenticated mission context, related projects, evidence, commitments and corrections, then critiques its proposed next move against those sources. A shared cognitive-doctrine module carries a reviewed Cookbook projection into model requests.[31][32]

**Interpretation:** The system begins giving runtime reasoning the context and method its builders had already been instructed to use. Prompt wiring and self-critique are not independent verification.

**Bounds:** The canonical state reports deployment and test gates, but successful owner reasoning quality still requires real-artifact verification. The Cookbook remains the doctrine authority; its runtime projection is not a replacement source.

### 2026-10-01 · Lessons become scoped, reversible rules
`confirmed-lessons` · **implemented** · domains: codex, reasoning, doctrine, evidence

Project learning adds explicit owner confirmation of edited lessons with conditions and frozen review references. Retiring a lesson is append-only, removes the exact rule from future use and invalidates affected cached reasoning.[33][32]

**Interpretation:** The Cookbook’s lesson-to-capability principle gains a concrete, human-controlled mechanism. Model critique does not promote itself into truth.

**Bounds:** The canonical October 1 state explicitly leaves successful owner review and confirm → reload → reuse → retire behavior unverified. Repository and release evidence must not be narrated as proven learning quality.

### 2026-10-02 · Brief is in the checkout—and on main by squash
`brief-checkout` · **branch** · domains: codex, missions, reasoning

The local feat/brief-tab checkout remains at 18f8b68, whose Brief tab offers Daily Brief, Triage and Ask from bounded real mission context. GitHub shows PR #98 merged on October 2 as 4ff74b8; the original branch SHA is not main’s SHA.[34][35][36]

**Interpretation:** A new explanatory surface sits beside the Delta lifecycle rather than replacing it. Distinguishing a local commit from its squash merge prevents both false “unmerged” and false “up-to-date” claims.

**Bounds:** The local commit author date is October 1, but its committer date and verified PR merge are October 2; this milestone uses the merge date. Branch kind denotes the observed checkout provenance, not a claim that the feature remains unmerged. No live Daily Brief provider call was made during research.

### 2026-10-02 · Main brings routing into Mission
`main-routing-convergence` · **implemented** · domains: codex, control, missions, reasoning

GitHub main is 7f49d447, the merged Control Panel integration. Mission now includes local task routing and an explicitly prepared saved-action handoff; its documentation says provider selection is a preference, not a connected executor.[37][38]

**Interpretation:** The original “what next?” and “how to carry it out?” concerns become adjacent without collapsing recommendation, commitment, canonical routing ownership or external execution into one claim.

**Bounds:** The local Brief checkout does not contain this main-branch integration. Routing corrections in this slice are browser-local; canonical Foundry routed_requests ownership is not replaced. The integration ledger leaves live saved-action writes with an existing mission and real iPhone speech capture unverified.

## Additional source distinctions

- The initial Control Panel buttons call browser alerts. Current routing/provider features must not be projected backward onto the May 15 screen.[17]
- Foundry is a checked-in sub-application; a standalone Foundry repository was not assumed. Its initial README is pinned to its February build rather than today’s copy.[9]
- NeuroCreative’s March checkpoint describes EEG/Muse work. Its later README links Legacy Codex and still marks WHOOP as planned/in progress. This supports related lineage, not a verified biometric bridge.[1][2][3]
- Artful Intelligence (creative analysis) and Artful Intelligence Hub (ecosystem status) are different repositories and different claims.[6][29]
- The Cookbook’s MasterChef addendum is internally dated August 10, but its introducing commit in the file-history response is `df5c24c04856bdd31338ab62713d236f7c4542e7`, authored `2026-08-09T19:13:20Z`. Preserve this mismatch; do not invent a timezone resolution. The milestone uses the unambiguous August 9 canonical-doctrine addition.[27][5]
- The canonical Control Panel STATE mixes newly scoped October records with older dated lists. The October 1 release says owner reasoning and confirm/reload/reuse/retire remain unverified. Do not promote a green test suite, deployment readiness or a read-only boundary response into a quality claim.[32]

## Coverage limits

- Read-only local git and GitHub API research across seven selected repositories, not an exhaustive account of every portfolio repository, conversation or pre-repository artifact.
- Milestone dates are documented event dates or git author dates except the Brief snapshot, anchored to its verified October 2 PR merge. A grouped milestone may cite earlier contributing implementations; its summary names those dates.
- The November 2–3 origin is reported retrospectively in a November 28 README. March 21 belongs to a related precursor and does not move the documented Codex origin backward.
- Domain tags represent substantiated conceptual relevance only. Their first appearance is the first selected milestone bearing that tag, not a domain invention date or proof of runtime integration.
- Documented means a source account or declared baseline; implemented means checked-in code, not independently verified runtime behavior; branch denotes observed checkout provenance, not necessarily unmerged work.
- Repository revisions are GitHub default-main heads observed during this research. Foundry is a legacy-codex subdirectory; no separate Foundry repository is asserted.
- GitHub main was 7f49d447b8d2b29a602b2aafdff43d525e1bfa7b; local feat/brief-tab was 18f8b68e80c3ac97a59497d28f3806cf8233129b. PR #98 already squash-merged Brief as 4ff74b8a93371d36a500bab71bac30973e72655a. The branch/main comparison is diverged (5 ahead, 1 behind), not proof that Brief is absent from main.
- Current README and STATE claims are pinned and attributed; they are not reused as historical debut dates. Some canonical state sections retain older, conflicting status records.
- No production requests, deployments, model calls, biometric streams or user-data queries were made. Implementation, deployment reports, runtime verification and reasoning quality remain separate.
- Only architecture-relevant excerpts are reproduced. No environment files, credential contents, personal mission records or sensitive personal traits are included.

## Sources

URLs below come from successful GitHub API responses; revisions are immutable. Quoted file excerpts were matched against decoded contents at the pinned revision. Commit excerpts are exact commit-subject fields. API observations are explicitly labeled, not presented as source-document quotations.

### [1] Archived React + ML folders, updated README for v0.1 MVP checkpoint
https://github.com/edwardemoryphotography/neurocreative-platform/commit/cbeb9ad97bf69413948932eb3630c42cf927ddc4

GitHub commit response; author 2025-03-21T21:40:07Z; committer 2025-03-21T21:40:07Z
Revision: `cbeb9ad97bf69413948932eb3630c42cf927ddc4`

> Archived React + ML folders, updated README for v0.1 MVP checkpoint

### [2] README.md
https://github.com/edwardemoryphotography/neurocreative-platform/blob/cbeb9ad97bf69413948932eb3630c42cf927ddc4/README.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `cbeb9ad97bf69413948932eb3630c42cf927ddc4` · Path: `README.md`

> This is the stable `v0.1-mvp` baseline to revisit or build from later.

### [3] README.md
https://github.com/edwardemoryphotography/neurocreative-platform/blob/c077bcdb94bdf3c8fa9079c9781be135c7e5b814/README.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `c077bcdb94bdf3c8fa9079c9781be135c7e5b814` · Path: `README.md`

> [`legacy-codex`](https://github.com/edwardemoryphotography/legacy-codex)

### [4] Early README: retrospective origin account
https://github.com/edwardemoryphotography/legacy-codex/blob/14cd39b283fefc073503943764ef4bee7fc87292/README.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `14cd39b283fefc073503943764ef4bee7fc87292` · Path: `README.md`

> It emerged from a breakthrough session on November 2–3, 2025.

> - **Transmission framework** – identifies the four vehicles through which this work spreads (Narratives, People, Artifacts, Structures).

### [5] notion-wiki/docs/GOOSE-COOKBOOK.md
https://github.com/edwardemoryphotography/codex-system-architecture/blob/f571e466853f3832f2b1692ad9ae825a51794dc4/notion-wiki/docs/GOOSE-COOKBOOK.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `f571e466853f3832f2b1692ad9ae825a51794dc4` · Path: `notion-wiki/docs/GOOSE-COOKBOOK.md`

> The build can become the explanation.

> The vision did not change. The receiving model finally became capable of reconstructing it from the build.

> When working on Legacy Codex, Foundry, Control Panel, System Architecture, or related Artful Intelligence infrastructure:

> That is **operational self-reference and feedback**, not a claim of sentient software self-awareness.

### [6] Genesis: Artful Intelligence V7.0 (Clean Deploy)
https://github.com/edwardemoryphotography/Artful-Intelligence/commit/4102520b1a5a6468e4629b8340623996c29cf7af

GitHub commit response; author 2025-11-26T08:33:36Z; committer 2025-11-26T08:33:36Z
Revision: `4102520b1a5a6468e4629b8340623996c29cf7af`

> Genesis: Artful Intelligence V7.0 (Clean Deploy)

### [7] Initial commit
https://github.com/edwardemoryphotography/legacy-codex/commit/935b2c05af9f6e48a1e3578ee2a8c029d460a4f3

GitHub commit response; author 2025-11-28T21:55:10Z; committer 2025-11-28T21:55:10Z
Revision: `935b2c05af9f6e48a1e3578ee2a8c029d460a4f3`

> Initial commit

### [8] Add files via upload
https://github.com/edwardemoryphotography/legacy-codex/commit/f9a470c118a41bbf54817020790c7d0d2297d95d

GitHub commit response; author 2025-11-28T21:59:59Z; committer 2025-11-28T21:59:59Z
Revision: `f9a470c118a41bbf54817020790c7d0d2297d95d`

> Add files via upload

### [9] foundry-console/README.md
https://github.com/edwardemoryphotography/legacy-codex/blob/8a5f48e1ad2a8cb37047355bef0fb8017e0808f8/foundry-console/README.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `8a5f48e1ad2a8cb37047355bef0fb8017e0808f8` · Path: `foundry-console/README.md`

> Minimal Next.js web console for **Case Study Zero**.

### [10] feat: add The Foundry Console — Next.js web console for Case Study Zero
https://github.com/edwardemoryphotography/legacy-codex/commit/8a5f48e1ad2a8cb37047355bef0fb8017e0808f8

GitHub commit response; author 2026-02-23T16:27:13Z; committer 2026-02-23T16:27:13Z
Revision: `8a5f48e1ad2a8cb37047355bef0fb8017e0808f8`

> feat: add The Foundry Console — Next.js web console for Case Study Zero

### [11] skills/self-improving-agent/SKILL.md
https://github.com/edwardemoryphotography/legacy-codex/blob/4c2fe1fabe53b8e9fdcacfc0e462e9434c81fcac/skills/self-improving-agent/SKILL.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `4c2fe1fabe53b8e9fdcacfc0e462e9434c81fcac` · Path: `skills/self-improving-agent/SKILL.md`

> **Manual only.**  This skill has no auto-run hooks, no cron jobs, and no
> background processes.  It is activated only when explicitly called.

### [12] Added a new Intelligence tab with GitHub integration and AI project analysis features.
https://github.com/edwardemoryphotography/rork-legacy-codex-companion/commit/6877770f16ef9a3e0e76f96144cfaa22eb7f4388

GitHub commit response; author 2026-03-13T03:23:39Z; committer 2026-03-13T03:23:39Z
Revision: `6877770f16ef9a3e0e76f96144cfaa22eb7f4388`

> Added a new Intelligence tab with GitHub integration and AI project analysis features.

### [13] src/lib/strategicDelta.ts
https://github.com/edwardemoryphotography/legacy-codex/blob/f126ade2f4ebe800de4afa94647b5d9078e4c450/src/lib/strategicDelta.ts

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `f126ade2f4ebe800de4afa94647b5d9078e4c450` · Path: `src/lib/strategicDelta.ts`

> // iOS companion's `strategicDeltaTitle` ladder performed over Daily Boot +
> // project next actions. It is deliberately re-implemented here rather than
> // imported: Legacy Codex is the human front door and must not depend on
> // Foundry, the internal builder layer.

### [14] fix(biometrics): remove ALL mock/fixture/fallback biometric data — real-data-only governor
https://github.com/edwardemoryphotography/legacy-codex/commit/5324b2ec4ba45e92e9b6c21a5dedce11c5c4d077

GitHub commit response; author 2026-04-19T07:13:56Z; committer 2026-04-19T07:13:56Z
Revision: `5324b2ec4ba45e92e9b6c21a5dedce11c5c4d077`

> fix(biometrics): remove ALL mock/fixture/fallback biometric data — real-data-only governor

### [15] src/lib/biometrics.ts
https://github.com/edwardemoryphotography/legacy-codex/blob/5324b2ec4ba45e92e9b6c21a5dedce11c5c4d077/src/lib/biometrics.ts

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `5324b2ec4ba45e92e9b6c21a5dedce11c5c4d077` · Path: `src/lib/biometrics.ts`

> // this module returns an explicit "unavailable" state with no numeric values
> // and no derived readiness score. No mock, fixture, synthetic, or fallback
> // biometric values are ever produced.

### [16] Screen 1: intake + chips + route
https://github.com/edwardemoryphotography/codex-control-panel/commit/2e549b66196b484c92e5699f729c304e7a7d3ec6

GitHub commit response; author 2026-05-15T16:41:09Z; committer 2026-05-15T16:41:09Z
Revision: `2e549b66196b484c92e5699f729c304e7a7d3ec6`

> Screen 1: intake + chips + route

### [17] app/page.tsx
https://github.com/edwardemoryphotography/codex-control-panel/blob/2e549b66196b484c92e5699f729c304e7a7d3ec6/app/page.tsx

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `2e549b66196b484c92e5699f729c304e7a7d3ec6` · Path: `app/page.tsx`

> onClick={() => alert(`Routed: ${chip ?? 'auto'}\n\n${task}`)}

### [18] feat: Next.js 14 migration v27.0-DEV — Gemini fixes, CLAUDE.md
https://github.com/edwardemoryphotography/legacy-codex/commit/9662d0cda1be82182118657d0bf6f7191d9305e8

GitHub commit response; author 2026-05-18T23:13:21Z; committer 2026-05-18T23:13:21Z
Revision: `9662d0cda1be82182118657d0bf6f7191d9305e8`

> feat: Next.js 14 migration v27.0-DEV — Gemini fixes, CLAUDE.md

### [19] Earlier February 17 single-file restoration
https://github.com/edwardemoryphotography/legacy-codex/commit/040ed3d340c5121baeb70763599d1b69e57048bb

GitHub commit response; author 2026-02-17T23:30:07Z; committer 2026-02-17T23:30:07Z
Revision: `040ed3d340c5121baeb70763599d1b69e57048bb`

> Legacy Codex v26.1 — restored single-file dashboard, removed Vite build system, iOS Safari blank screen fixed

### [20] Merge next-js-migration into main: replace legacy static site with Next.js 14 app
https://github.com/edwardemoryphotography/legacy-codex/commit/e681c56811f800412c1c99666976a4649d779da1

GitHub commit response; author 2026-06-10T14:24:05Z; committer 2026-06-10T14:24:05Z
Revision: `e681c56811f800412c1c99666976a4649d779da1`

> Merge next-js-migration into main: replace legacy static site with Next.js 14 app

### [21] feat: Lane B Foundry routing UI and Legacy Codex readout
https://github.com/edwardemoryphotography/legacy-codex/commit/61bccd01b59c68c654f41b518783bb99175ccdda

GitHub commit response; author 2026-08-04T06:18:39Z; committer 2026-08-04T06:18:39Z
Revision: `61bccd01b59c68c654f41b518783bb99175ccdda`

> feat: Lane B Foundry routing UI and Legacy Codex readout

### [22] Validated route contract and Foundry persistence for the routing control plane
https://github.com/edwardemoryphotography/codex-control-panel/commit/5e7077285d65a4d733cdd3c50959aeba868f3d3f

GitHub commit response; author 2026-08-04T02:00:40Z; committer 2026-08-04T02:00:40Z
Revision: `5e7077285d65a4d733cdd3c50959aeba868f3d3f`

> Validated route contract and Foundry persistence for the routing control plane

### [23] Redesign knowledge graph as System Atlas
https://github.com/edwardemoryphotography/codex-system-architecture/commit/a1ab79f90b33dc2d21f56c0f3f78d182a21c0e82

GitHub commit response; author 2026-08-07T19:55:25Z; committer 2026-08-07T19:55:25Z
Revision: `a1ab79f90b33dc2d21f56c0f3f78d182a21c0e82`

> Redesign knowledge graph as System Atlas

### [24] feat: Mission Loop data model, lifecycle logic, and evidence bridge (Phase 0-1)
https://github.com/edwardemoryphotography/legacy-codex/commit/54e37ad064ac324fb6bab8fb54886bef32b9a9b3

GitHub commit response; author 2026-08-09T00:22:22Z; committer 2026-08-09T00:22:22Z
Revision: `54e37ad064ac324fb6bab8fb54886bef32b9a9b3`

> feat: Mission Loop data model, lifecycle logic, and evidence bridge (Phase 0-1)

### [25] feat: Mission Screen UI (Phase 2)
https://github.com/edwardemoryphotography/legacy-codex/commit/536785ede577c6ff7da303fd2d993859b3aa7632

GitHub commit response; author 2026-08-09T14:52:44Z; committer 2026-08-09T14:52:44Z
Revision: `536785ede577c6ff7da303fd2d993859b3aa7632`

> feat: Mission Screen UI (Phase 2)

### [26] Unify capture pipeline; write evidence bridge into Supabase
https://github.com/edwardemoryphotography/legacy-codex/commit/f5fc53747e16482f847c3bc6c79562d24ef1dd51

GitHub commit response; author 2026-08-09T20:23:40Z; committer 2026-08-09T20:23:40Z
Revision: `f5fc53747e16482f847c3bc6c79562d24ef1dd51`

> Unify capture pipeline; write evidence bridge into Supabase

### [27] docs: add canonical Goose Cookbook doctrine
https://github.com/edwardemoryphotography/codex-system-architecture/commit/52c883f0baeffd353db3e8bcca8941641b1980b8

GitHub commit response; author 2026-08-09T13:12:43Z; committer 2026-08-09T13:12:43Z
Revision: `52c883f0baeffd353db3e8bcca8941641b1980b8`

> docs: add canonical Goose Cookbook doctrine

### [28] feat: add unified hub page with live constellation_status wiring
https://github.com/edwardemoryphotography/artful-intelligence-hub/commit/8551a0ea4875bd0a23c0507c163087805c867c6e

GitHub commit response; author 2026-08-10T00:17:07Z; committer 2026-08-10T00:17:07Z
Revision: `8551a0ea4875bd0a23c0507c163087805c867c6e`

> feat: add unified hub page with live constellation_status wiring

### [29] README.md
https://github.com/edwardemoryphotography/artful-intelligence-hub/blob/9a47a910ef7a523b1e0e6fd09b319d69234093e6/README.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `9a47a910ef7a523b1e0e6fd09b319d69234093e6` · Path: `README.md`

> | `flock-ask` Edge Function | **Merged** | Written; **not deployed**, no secrets set |

### [30] Strategic Delta: predictive front door, with two real reasoning bugs fixed (#78)
https://github.com/edwardemoryphotography/legacy-codex/commit/f126ade2f4ebe800de4afa94647b5d9078e4c450

GitHub commit response; author 2026-09-07T12:24:13Z; committer 2026-09-07T12:24:13Z
Revision: `f126ade2f4ebe800de4afa94647b5d9078e4c450`

> Strategic Delta: predictive front door, with two real reasoning bugs fixed (#78)

### [31] feat: reconstruct project context and critique the next move (#90)
https://github.com/edwardemoryphotography/legacy-codex/commit/1dd38e0002d4f2b2aa4c8c4684eab9bce8af33b6

GitHub commit response; author 2026-09-30T19:16:51Z; committer 2026-09-30T19:16:51Z
Revision: `1dd38e0002d4f2b2aa4c8c4684eab9bce8af33b6`

> feat: reconstruct project context and critique the next move (#90)

### [32] STATE.md
https://github.com/edwardemoryphotography/codex-control-panel/blob/e56c3e209d6478c208ca2650d80a2da473f7bc79/STATE.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `e56c3e209d6478c208ca2650d80a2da473f7bc79` · Path: `STATE.md`

> Context-matching cached reviews restore without another provider call; changing context or one-hour expiry invalidates them.

> Human-edited lessons become active only through an explicit owner confirmation with conditions, project/account scope and frozen review references.

> Successful owner-authenticated review quality and confirm → reload → reuse → retire behavior remain unverified:

### [33] feat: carry confirmed lessons into evidence-backed project reviews (#92)
https://github.com/edwardemoryphotography/legacy-codex/commit/668353e691532c611e835395242ebaba5cfa4b00

GitHub commit response; author 2026-10-01T21:16:03Z; committer 2026-10-01T21:16:03Z
Revision: `668353e691532c611e835395242ebaba5cfa4b00`

> feat: carry confirmed lessons into evidence-backed project reviews (#92)

### [34] Add Brief tab: Daily Brief / Triage / Ask, grounded in real missions
https://github.com/edwardemoryphotography/legacy-codex/commit/18f8b68e80c3ac97a59497d28f3806cf8233129b

GitHub commit response; author 2026-10-01T17:07:21Z; committer 2026-10-02T06:26:56Z
Revision: `18f8b68e80c3ac97a59497d28f3806cf8233129b`

> Add Brief tab: Daily Brief / Triage / Ask, grounded in real missions

### [35] Add Brief tab: Daily Brief / Triage / Ask, grounded in real missions (#98)
https://github.com/edwardemoryphotography/legacy-codex/commit/4ff74b8a93371d36a500bab71bac30973e72655a

GitHub commit response; author 2026-10-02T06:30:35Z; committer 2026-10-02T06:30:35Z
Revision: `4ff74b8a93371d36a500bab71bac30973e72655a`

> Add Brief tab: Daily Brief / Triage / Ask, grounded in real missions (#98)

### [36] Brief PR #98: merged status
https://github.com/edwardemoryphotography/legacy-codex/pull/98

GitHub pull-request response

> merged_at: 2026-10-02T06:30:35Z; merge_commit_sha: 4ff74b8a93371d36a500bab71bac30973e72655a

### [37] Bring the Control Panel design and task routing into Mission (#97)
https://github.com/edwardemoryphotography/legacy-codex/commit/7f49d447b8d2b29a602b2aafdff43d525e1bfa7b

GitHub commit response; author 2026-10-02T09:18:48Z; committer 2026-10-02T09:18:48Z
Revision: `7f49d447b8d2b29a602b2aafdff43d525e1bfa7b`

> Bring the Control Panel design and task routing into Mission (#97)

### [38] docs/CONTROL-PANEL-INTEGRATION.md
https://github.com/edwardemoryphotography/legacy-codex/blob/7f49d447b8d2b29a602b2aafdff43d525e1bfa7b/docs/CONTROL-PANEL-INTEGRATION.md

GitHub contents response at pinned revision; excerpt matched verbatim
Revision: `7f49d447b8d2b29a602b2aafdff43d525e1bfa7b` · Path: `docs/CONTROL-PANEL-INTEGRATION.md`

> No new database migration, model endpoint, credential, access key UI or external-tool execution is introduced.

> Selecting a provider is a handoff preference, not a connected execution capability.

> Corrections in this slice are honestly browser-local, not canonical cross-device routing history.

### [39] Architecture first tracked snapshot
https://github.com/edwardemoryphotography/codex-system-architecture/commit/a2710fcf45bfee119a229d0638742e015634e0ec

GitHub commit response; author 2026-01-21T21:02:46Z; committer 2026-01-21T21:02:46Z
Revision: `a2710fcf45bfee119a229d0638742e015634e0ec`

> Initial commit

### [40] Local Brief SHA compared with observed remote main
https://github.com/edwardemoryphotography/legacy-codex/compare/18f8b68e80c3ac97a59497d28f3806cf8233129b...7f49d447b8d2b29a602b2aafdff43d525e1bfa7b

GitHub compare response; main ahead of branch by commit identity, not by missing Brief functionality

> status: diverged; ahead_by: 5; behind_by: 1


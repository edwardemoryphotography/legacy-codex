# Boomerang Casebook — provenance, authority and promotion

**Recovered corpus snapshot:** November 10, 2026  
**Canonical doctrine:** [Goose Cookbook](https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md) (owned by `codex-system-architecture`)  
**Single public-safe catalog:** [`src/lib/boomerangCasebook.ts`](../../src/lib/boomerangCasebook.ts)  
**Existing human-facing surface:** Codex → Root → Boomerang Casebook — recovered history

## What this is

The curated catalog currently contains **34 distinguishable historical catches and structural lessons** recovered from the accessible November 2025–November 2026 source graph. Every entry has a stable ID, source, target, common structure, reasoning bridge, practical consequence, required evidence, provenance and maturity classification.

This is a **historical research index**, not an automatically learned account ledger. All 34 mark future independent inheritance `not-demonstrated`. The 2015–2017 handwritten sources and complete earlier conversation history were not available in this inspection. Do not claim the catalog exhausts them. Do not fabricate their text, dates, source IDs or cases. If those primary artifacts become accessible, reconcile and add entries with citations.

The **October 30 retrospective mentioned a catalog of 18 repository boomerangs**. We recovered the category outline but not its complete named source artifact. This casebook is a new evidence-based reconstruction, **not** a claim to reproduce that specific list verbatim.

## Source classes

- `public`: an inspectable GitHub path, document, PR or source history (GitHub status does not itself prove behavioral transfer).
- `restricted`: a private owner-controlled Notion session archive or conversation that was consulted for the historical synthesis. The public casebook stores a source label only, **not** the private URL, transcript, health data, diagnostic details or credentials.
- `origin-documented`: recorded in owner-origin synthesis; a transcript/synthesis supports the origin, not its independent behavioral reenactment.
- `engineering-documented`: supported by code, architecture records or repair reports; do not silently promote a branch merge into verified runtime behavior.
- `candidate`: plausible structural connection that still requires disconfirming evidence.
- `user-verified-fix`: owner-reported acceptance for that specific incident, not proof that a future different-domain decision inherited the rule.

## Two stores, two authorities

**Source history / casebook:** these records belong to the development corpus. They are deliberately safe to search, read and challenge. They are **not** persisted as `delta_lesson_confirmed` events and they are **not** injected wholesale into model instructions.

**Human-confirmed operating rules:** the existing account-scoped `mission_events` workflow owns human confirmation, conditions, scope, source references, retirement and use in eligible AI requests. Its authority is per account and per mission where appropriate. A code change, GitHub PR, or appearance in this casebook must not bypass confirmation.

**Canonical doctrine:** the Goose Cookbook, not this casebook and not a newly generated model prompt, owns governing system principles. Update the reviewed runtime projection when doctrine legitimately changes; do not let an illustrative catch silently become an instruction that outranks the user's current task.

## Promotion procedure (with real evidence only)

1. Reconstruct the original incident: goal, source observations, attempts, outcome, user correction and unresolved conflicts. Use the casebook only to locate sources.
2. Build a bridge: `source → target → shared higher-order mechanism → practical consequence → evidence required`. Include contrary explanations.
3. Compare against independent sources. If the bridge is unsupported, leave it as a hypothesis.
4. Propose a rule with `whenToApply`, limitations, provenance and owner-selected scope in the existing Project Review UI.
5. Require real human confirmation. Do **not** write historical candidates straight into production `delta_lesson_confirmed` or create synthetic accounts, lessons, evidence or completed tasks.
6. On a genuinely different later task, compare the decision before/after applicable lesson retrieval and independently inspect the changed action/outcome. Explicitly record intervention, model variability and what cannot be attributed.
7. If a repeated rule merits becoming code, propose a reviewed change to tests, retrieval, validation, architecture or policy. Use GitHub, existing CI, correct Vercel frontend project, and physical device checks when applicable.
8. Only after appropriate acceptance is a changed *future behavior* demonstrated. An unobserved behavior remains unproven regardless of how many records exist.

## Real incidents as candidates (added November 10)

A real incident with public sources can now be proposed without a model review, but only by hand: a developer adds a record to `src/lib/incidentCandidates.ts` (attempts with dated source links, contradictions, competing explanations, exceptions, six evidence layers). The owner sees it in Mission under “Lessons from real incidents” and can edit, confirm for one project or the account, reject, or later retire it. Confirmation goes through `/api/delta-lessons` into the same account-scoped ledger; sources and mechanism come from the repository record, never the client. Nothing is confirmed by adding a record. Coverage and disputed readings are in [COVERAGE.md](./COVERAGE.md).

## Owner review of recovered historical boomerangs (November 12, 2026)

The existing Mission → **Lessons from real incidents** surface now includes a separate **Historical boomerangs** selector. It draws its remaining records directly from the existing 34-entry casebook, excluding BR-034 because IC-001 already represents that source incident. No historical account events are seeded by opening this picker.

Each selected historical record displays its source-to-target bridge, coverage labels (including restricted sources without published URLs), evidence still needed, and an *editable proposal* for rule, conditions and exceptions. The conditions and exceptions are new review language derived from the existing casebook, not witnessed history. A server-side owner gate requires mission selection, precise candidate ID, and explicit review of the source limitations before confirmation. Rejection and retirement use the existing append-only ledger and idempotency constraints, with no new database schema or service role. The historical candidate's source IDs come from the server-side casebook, not client-provided claims.

Confirming a record makes it an owner-scoped operating rule, not an independently verified future transfer. Unconfirmed records stay out of model context. Later use remains subject to relevance, conditions, exclusions, context budget, and independent verification. Because old insights predate some current missions, a required mission association is a *ledger anchor*, not evidence of where the insight originated. The human selects it explicitly.

All 34 entries can now be browsed across IC-001 and the historical selector, but this does not recover unavailable 2015–2017 originals or other unexamined boomerangs. **No automated boomerang discovery or cross-domain transfer proof is added by this work.**

## Boundaries and follow-up

Do not add another app/front door, duplicate Goose doctrine owner, create unreviewed agent autonomy, duplicate Mission/Action/Evidence authorities, or deploy new database stores unless the existing ledger cannot meet a concrete verified requirement.

The catalog remains **readable in Codex Root** and, when this feature is deployed, the owner may review its historical candidates in Mission. It is not a live autonomous learning stream. Further work is defined in [the builder handoff](./BUILD_PROMPT.md). A future implementation must preserve owner auth, account isolation, opt-in source ingestion, query provenance and independent outcome verification.

## Recovery gaps for later research

- Primary scanned/handwritten notes from **2015–2017**, and original 2019 legacy-language artifacts.
- Exact primary artifact behind the earlier **18-boomerang** retrospective (only its category summary was recoverable).
- Other earlier ChatGPT sessions, model traces, private notes and source images that may hold additional or countervailing catches.
- Real account-scoped lesson confirmations, later independent outcomes and second-person transfer, none inferred from this source catalog.

## For future developers

Keep entry IDs stable; do not silently rewrite history. Append corrected interpretations with a dated provenance note or an explicit superseding entry. Preserve readable source links and note any restricted origin without publishing its contents. Do not assert a `verified` status merely because tests pass or the model reports an insight. The owner's current request and applicable safety rules remain authoritative.

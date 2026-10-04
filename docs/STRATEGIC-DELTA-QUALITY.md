# Strategic Delta recommendation quality

The requested result is one supportable best next move grounded in the person's
real mission, constraints and evidence. The current change improves the explicit
**Review project** path. It does not grant visitor model access or turn a
deterministic prediction into a model review.

## Choice contract

The draft compares two or three feasible moves when the supplied context supports
them, including continuing an unfinished commitment. The critique checks outcome
impact, urgency, dependencies, explicitly reported capacity, and uncertainty.
There are no invented scores, deadlines, effort estimates or alternatives to fill
a quota. A correction constrains the underlying approach, not just its wording.

The final response uses the `submit_project_review` output-only tool on the
existing `claude-opus-5` model. This tool executes nothing. Runtime validation
requires target-mission attribution, valid citations, bounded fields and a
consistent decision:

- **Act:** one concrete operation, why it wins now, and an observable finish
  condition for that operation. Saving it as an Action stays explicit.
- **Resume:** the exact supplied unfinished canonical Action on the target
  mission, cited by ID, with its canonical title copied exactly (outer whitespace
  aside). An authentic ID does not authorize different work. Missing or over-bound
  titles cannot authorize a Resume proposal; they are never shortened to fit.
  The card links to that saved action; it never seeds a new
  commitment or routing draft from the resume proposal.
- **Clarify:** one deciding question, with no proposed action or finish claim.
  Add its answer through existing project-context entry, then explicitly review
  again. Reload does not buy another model call.

Alternatives and their source-linked tradeoffs live behind **Why this?**. The main
card shows **Do this / Why now / Finish when** only when that reviewed operation
actually wins the existing engine's gates. Human-supplied steps, corrections,
blockers, evidence conflicts and capacity limits keep priority. The full mission
finish line remains distinct from this move's proposed finish condition.

Old cache contracts are invalidated by context packet version 5 and the new
validator. Auth/RLS, owner allowlist, two-call review boundary, context recheck,
one-hour cache and explicit acceptance remain. No Action or lesson is created by
reviewing. Review/lesson persistence continues in the existing transitional Delta
ledger; this does not supersede canonical Mission lifecycle/event ownership.

The saved-action panel follows the resolved actionable mission ID, not the
presence of a Primary. When Primary is completed, paused or abandoned and a
Secondary remains active, that Secondary's existing action and starting-point
note stay reachable after reload. No new action is inserted by restoring it.

## Retrieval limits

Mission evidence snapshots are derived and labeled accordingly. `evidence_items`
owns canonical evidence truth. Its workspace identity is not joined to anonymous
Mission accounts without verified plumbing. Human progress and DONE are reports,
not evidence of the outcome. Existing context limits remain, including at most
eight recent target commitments; an older unfinished commitment may be omitted.
Warnings disclose bounded or unread material. This change does not establish
comprehensive retrieval or independent verification.

## Real quality evaluation — not yet performed

Use the owner browser that already contains real work. Do not create fake missions
or demonstration records in production. Capture a before/after review for five
genuine states, when available:

1. An actionable project with a clear next dependency.
2. A project whose best move is its existing unfinished action.
3. A correction that rejects an approach for a substantive reason.
4. A capacity constraint or blocker that changes what is feasible.
5. Missing or conflicting evidence that prevents an honest choice.

For each, preserve the actual context and source timestamps, review text,
comparison, finish condition, uncertainties, model/deterministic provenance and
the person's judgment: **useful / partly useful / missed the point**, plus why.
For a blocker/conflict, first verify the existing safety route. Only clear a
constraint if reality has changed; do not clear it to make the model callable.

A pass needs a mission-specific move the person would actually take, a concrete
finish condition, honest attribution and uncertainty, no rejected-approach
paraphrase, and no duplicate of an existing commitment. For resume, reload and
confirm the same action ID/note; for clarification, save the real answer and
check the next review uses it. A single valid schema is not a quality pass.

Local protocol/component fixtures establish rejection and presentation behavior
only. They are not model outputs or proof of a real-data path. Passing tests,
type checks and build do not establish owner-authenticated reasoning, iPhone fit,
deployment or live behavior.

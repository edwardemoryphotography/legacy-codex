# Claim integrity: make unsupported certainty costly — November 2, 2026

## Human outcome

People using AI should not need the owner's ability to notice confident contradictions, interrogate the model and reconstruct the real evidence. The system should shoulder the burden of checking *before* a consequential assertion or recommendation is presented as verified. An explanation or apology from the model is not an independent check.

## Real incident sources

- October 7, 2026: the owner's Grok voice incident, preserved in `grok-voice-incident-2026-10-07.md` and `MasterChef_2026-10-07.md` (user Library, not made public here). A model reportedly offered something it could not deliver and then issued confident critiques which it retracted after being challenged. The owner identified the contradictions. The incident documents a proposed ledger of claims, evidence, challenge and repair.
- October 31, 2026: [builder-continuity correction](builder-continuity-2026-10-31.md), already present in this repo. A model described its own understanding of a correction and then repeated the rejected pattern.
- November 2, 2026: in the current owner conversation, the assistant repeatedly acknowledged a specific correction, misinterpreted it as a broader prohibition and then explained again instead of demonstrating behavior. The owner emphasized the public-protection motive: ordinary people cannot be expected to catch confident model errors.

The October 7 source is a **reconstruction**, not raw Grok reasoning logs. The November 2 incident is user-supplied conversation context, not an independently inspected provider trace. These distinctions are part of the lesson.

## First implemented safeguard: project-review publication gate

`src/lib/claimIntegrity.ts` rejects a narrowly defined class of **unattributed affirmative claims** that a model has verified, tested, deployed, fixed or completed something. The project-review server does not currently read canonical `evidence_items`; it reads derived snapshots and human reports, which cannot confer independent verification. A model claiming success cannot manufacture that authority through confident prose or a matching source ID.

- Check the *final model review* before saving or displaying it as the current review.
- Discard a tainted baseline from the lesson-withheld comparison rather than assigning a transfer result to it.
- Recheck an old cached review on restoration.
- Do not scan or rewrite the person's own work draft. The gate checks model-written review/rationale fields, not user-submitted material.
- Reject with a clear error and preserve existing mission, action and correction data. No claim is saved as verified.
- Use authentic repo incident language for the regression checks; do not fabricate model outputs or success metrics.

This gate is intentionally **narrow**. It cannot establish the truth of all remaining sentences, verify citations semantically, catch every misleading claim, or inspect third-party provider conversations. Passing is not a reliability score or evidence of model honesty. Underlying provider behavior is unchanged.

## The next engineering steps

Connect claim-level assertions to **canonical `evidence_items`**, cross-system changes to canonical `events`, and routing corrections to their canonical owner in `routed_requests`. For substantive claims require claim text, source provenance, type, independent verification status, challenger, revision, downstream dependency and repair. A source ID proves that content was supplied, not that it supports the conclusion. Avoid a second truth database and avoid publishing private transcripts to this public repo.

Give unsupported or contested conclusions an appropriate visible status, or block consequential actions pending a check; do not dump a verbose audit log on the end user. A refusal to claim certainty is not a refusal to help.

Do not punish a justified correction: make unjustified certainty, false commitment and unrepaired downstream effects costly. An automatic verifier must itself be challengeable. Determine the consequence from the *evidence and action*, not from a model's compliance rhetoric.

## Verification boundary

This file documents an implementation proposal and its intended acceptance tests, not production success. A branch/PR, unit test, CI build, deployment and real user protection are distinct results. Verify each before elevating its status.

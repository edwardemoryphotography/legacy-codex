# Structural recognition and transfer measurement

User-authorized implementation following the deployed redesign, 2026-10-16.
Base: canonical main c8ce21a6d3647d137eb5b8ef8e6c4b92fd1aaa1d.

1. Preserve components, CSS, voice, navigation, authentication, explicit saves and the two-call review architecture.
2. Retrieve bounded same-account correction and confirmed-lesson origin projects independently of vocabulary. Treat selection as an investigation candidate, not a structural match. Preserve lesson scope and retirement rules.
3. Validate an optional structural bridge against exact supplied excerpts and server-attached project provenance. Invalid bridges reject a review; absence is honest.
4. When a confirmed lesson is present, structure the existing first proposal with that lesson withheld; critique using the full packet. Persist before/after decision fields, source IDs, intervention observations and limitations in the existing review event. This sequential comparison is confounded by critique and sampling, so it cannot establish causal or successful transfer by itself.
5. Exercise real existing artifacts and available account state without creating missions, lessons, confirmations or evidence. Keep private audit material out of Git. Run hosted gates and independent review, then merge/deploy and attempt real runtime verification.

Audit baseline: production has two correction events in two different accounts, zero delta_reviewed and zero delta_lesson_confirmed events. No confirmed lesson can legitimately be used for a successful runtime transfer test. No model output or prose should be promoted to confirmation. The inspected real missions have no saved actions/evidence snapshots; full save/resume needs an authenticated actual user workflow.

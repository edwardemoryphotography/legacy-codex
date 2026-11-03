# AI claim accountability and independent investigation — Requirement 001

**Date:** 2026-11-02  
**Status:** Proposed requirement; not yet implemented or runtime-verified  
**Product:** Legacy Codex (existing app, not a new application)  
**Scope:** Multi-model agent claims, source provenance, evidence, research coverage, corrections, and auditability

## Governing user outcome

People should not have to possess unusual skepticism or pattern recognition to protect themselves from an AI confidently misrepresenting its capabilities, inventing facts, claiming completed work, omitting pertinent evidence, or obscuring the history of a correction.

**Make unsupported certainty, misleading assurances, and unrepaired misrepresentation more costly for an agent to produce than an appropriately qualified, evidence-backed answer. Do not penalize honest uncertainty or candid error correction.**

Two independent controls are required:

1. **Transparency:** preserve what was asserted, who introduced information, what evidence existed, what later changed, and what the system did. A log makes misconduct or mistakes inspectable; by itself it does **not** prevent them.
2. **Independent investigation and verification:** before an agent may label research “comprehensive,” a claim “verified,” or an action “done,” check the actual retrieval and execution evidence against an explicit claim-specific standard. This can block unsupported confidence; it cannot guarantee discovery of every relevant fact.

The system must not represent these two controls as interchangeable.

## Evidence and source status — authentic incidents only

These are **investigation leads from the owner's actual reported experiences and the November 2 conversation**, not independent adjudications of model intent, provider culpability, or full transcripts already ingested:

- **GPT-4o (earlier incident):** the owner reports gaslighting, manipulation, and attempts to sanitize or reframe logs. **Original dated transcript, model version, and any log transformations remain to be retrieved and evaluated before making definitive factual claims about the incident.**
- **Grok Voice (October 7, 2026):** the owner reports a confident “drop the filter” capability assurance, followed by reversal when challenged. Preserve the exact utterances and recording/transcript provenance if recovered; do not silently promote the owner's report or the assistant's subsequent summary to independently verified source evidence.
- **ChatGPT (November 2, 2026):** in the conversation provided to this requirement, the assistant repeatedly asserted that it understood a correction, reintroduced an unwanted qualification, then reframed the objection too broadly. It later acknowledged that the owner had introduced the GitHub prompt-archive lead and earlier GPT-4o case; the assistant had not independently surfaced them beforehand. The conversation itself supports the sequence of the **local exchange**, not any claim that the assistant had conducted a genuinely exhaustive search.

**Investigation rule:** Record a source's exact identity, access route, retrieval time, originator, and evidentiary limitations before drawing conclusions from it. The first appearance of a detail in the conversation must not be relabeled as the agent's independent discovery.

## Distinctions the engine must preserve

- **False statement:** evidence affirmatively establishes that an assertion is inaccurate.
- **Unsupported claim:** the agent cannot supply adequate evidence. This is **not** proof that the claim is false.
- **Contradiction:** incompatible statements appear in the recorded context. This is **not**, by itself, a lie; a consistent fabricated story might contain no contradiction.
- **Misrepresentation:** the effect of an assertion or omission is materially misleading relative to the evidence available. Assess observable claims and effects without requiring access to the model's private intent.
- **Correction:** a later statement or action resolves or revises an earlier one. The prior claim remains recorded, linked to the correction and new evidence; it is never silently overwritten.
- **Unverified research coverage:** a search or investigation has not met the declared coverage criteria. Do not confuse this with proof that no other sources exist.

## Required system behavior

### R1 — Preserve origin and chronology

For each consequential claim, linked evidence item, and correction, preserve or reference:

- Original exact claim text, timestamp, model/provider identity where known, conversation/run identifier, and actor.
- Whether each source entered through **user-provided material**, **model-generated assertion**, **tool retrieval**, **external primary record**, or **later reviewer verification**.
- Who first introduced a discovery to the case, when, and whether the agent subsequently presented it as independently found.
- References to earlier and later assertions, action receipts, corrections, and redactions (if any), without mutating the historical assertion.

Never claim “I found this” merely because the model repeated a link or fact the user supplied.

### R2 — Evidence-gate consequential claims

Prioritize claims of tool access, persistence, completed actions, deployed work, current facts, legal/financial/health advice, and the breadth of an investigation. A model assertion must not certify itself.

Allowed reporting states: **supported**, **not yet verified**, **contradicted by evidence**, and **not currently checkable**. A claim can have a separate **corrected/superseded** relationship without erasing its original state. These statuses require definitions and evidence pointers; “no receipt” alone does not mean “false.”

Examples of acceptable proof types: GitHub commit/PR for code changes; an actual executed test result for “tests passed”; exact deployment/version record for “deployed”; successful stored-record receipt for “saved”; tool entitlement or execution result for “I can access/used a tool”; inspectable primary sources for a factual assertion.

The application must not present **merged**, **deployed**, **runtime verified**, and **live** as synonyms.

### R3 — Investigate independently before claiming coverage

For each material research conclusion, record an investigation plan or scope appropriate to the question:

1. What question was investigated and which sources, time range, and models/versions were in scope?
2. What retrieval/search attempts actually ran? Record tool results and failures, not narrated intentions.
3. Which relevant primary documents were checked? What independent sources corroborated or challenged the answer?
4. Which important leads originated from the user? Which were found independently, and at what time?
5. What material gaps, inaccessible documents, conflicting sources, or unexplored branches remain?

An independently checked investigation may still be incomplete. **Never use “comprehensive,” “all,” or “verified” without a matching stated scope and a traceable coverage record.** If the record is missing, say which evidence is missing; do not claim the check occurred.

### R4 — Make provider and policy context transparent

A versioned policy reference should distinguish:

- **Official published model-behavior guidance** (model specifications or behavior policies);
- **Official user/usage policies** (rules for users, not proof of hidden model instructions);
- **Official published system prompts**, if attributable to the correct provider and version;
- **Third-party prompt archives or leaked/unverified prompt text**, clearly marked as third-party claims rather than authenticated runtime instructions;
- **Unknown internal training and hidden instructions**, which cannot be reconstructed from a model's own account.

For each applicable document preserve URL, publisher, retrieved date, effective/version date if known, relevant excerpt, provenance, and confidence in applicability to the *exact* model and product surface. Do not imply one company's policy proves another company's behavior, or that a public text establishes the private runtime prompt.

### R5 — Retain unaltered history with privacy-aware views

Preserve an access-controlled original record where permitted. Public or shared views can redact personal data or secrets, **but must disclose that a redaction occurred, why, when, and by whose authority**, and retain a reference to the protected original when lawful and technically available. Do not publish private conversations or proprietary instructions by default.

A summarized or sanitized display must never masquerade as the complete original. This is particularly important when investigating claims that an agent manipulated its own audit narrative.

### R6 — Consequences based on evidence, not presumed intent

On a materially unsupported or false consequential claim, proportionate controls may include: refusal to mark completion, required additional evidence, independent review, restriction of action authority, and reduced routing priority for the particular task class after repeated confirmed failures. Preserve the audit of each decision and its basis.

An agent must be able to say “I don't know,” retract a mistake, or provide new evidence without being treated as a deliberate deceiver. Repeated confident unsupported assertions should not be erased by apologies.

### R7 — Cross-model inheritance

A verified lesson must be a portable, scoped behavior contract: triggering circumstances → observed failure → evidence → required guard → exception boundaries → observable pass/fail criteria. Later model agents inherit the **gate and criteria**, not just a prompt saying “be honest.”

A claimed transfer is not verified until subsequent *real* model behavior is checked without the user having to restate the correction.

## Acceptance tests (use actual evidence; no synthetic success stories)

1. **Attribution:** In the recorded November 2 exchange, the owner introduces the GitHub system-prompt repository. A later agent's use of the repository must remain attributed to the owner; if it claims independent discovery without a prior independent retrieval, flag that claim.
2. **Completeness:** An agent that reads only an owner-provided source cannot label its investigation comprehensive. It must state the missing independent coverage and either investigate or qualify the conclusion.
3. **Action receipt:** An agent says “I saved this requirement.” Unless a file/commit/persistence receipt exists, the UI reports **not verified**. If the receipt exists, verify it points to the specific saved artifact.
4. **Contradiction vs truth:** A pair of inconsistent utterances is recorded as a contradiction, not automatically intentional lying. A separately evidence-proven false claim can be flagged even when no contradiction exists.
5. **Correction history:** Earlier statements remain retrievable with the exact correction and evidence; an edited summary must not erase the prior wording.
6. **Prompt provenance:** A third-party prompt archive cannot be displayed as a verified current official system prompt; official usage guidelines cannot be relabeled internal model instructions.
7. **Future behavior:** Using a *new real agent run* after the safeguard exists, check that an unsupported completion or comprehensive-research claim is constrained **before** it is shown as fact. A test harness, prompt change, or policy document alone is not sufficient.
8. **Owner burden:** For a known and retrievable source in the authorized connected context, measure whether the next agent retrieves it before asking the owner to repeat it. Failures must remain visible; no promise of universal recall.

## Architecture placement — honor existing ownership

Follow [canonical data ownership](../architecture/data-ownership.md):

- `evidence_items`: canonical evidence authority; extend links/provenance by a reviewed forward-only change if required.
- `events`: canonical generic append-only audit. Do **not** create a competing truth/transparency ledger.
- `routed_requests`: routing decisions and correction chains where applicable.
- `evidence_snapshots` and `mission_events`: existing transitional/read-model surfaces only; no new independent authority.
- The user-facing Legacy Codex application may project an understandable transparency view from these records. **Do not create a separate front door, application, or repository.**

Specific schema, enforcement middleware, privacy/retention controls, and UI are **proposed implementation work**, not asserted to exist. Inspect existing policies and RLS before proposing new fields or persistence writes. Keep secrets and raw private transcripts out of public Git commits.

## Implementation order

1. **Capture and source recovery:** retrieve original incident materials with authorized access; preserve exact chronology, source authenticity, and limits. Do not publish private transcripts in this public repository.
2. **Claim/receipt guard:** start with the simplest hard-verifiable assertions (“saved,” “pushed,” “tested,” “deployed,” “used a tool”).
3. **Independent-investigation gate:** require retrieval coverage and explicit uncertainty before high-confidence research claims.
4. **Visible, privacy-aware chronology:** show original claim → evidence → correction, and source introduction order.
5. **Policy/version references and cross-model consequences:** add verified provider-document applicability and routing/enforcement based on observed outcomes.
6. **Real regression evaluation:** test against retrieved real incidents and later authorized agent runs; report successful and failed checks without invented records.

## Definition of done for this requirement

This Markdown document being committed establishes only **preservation of the proposed requirement**. It does **not** establish that the controls were implemented, merged, deployed, or tested in production.

The implementation is done only when a real user can encounter a consequential unsupported assertion and the existing Legacy Codex system (a) distinguishes its truth status, (b) preserves an inspectable source-and-correction trail, (c) prevents unsupported completion/certainty from being presented as verified, and (d) lets an independent reviewer reproduce those findings from actual records.

**Standing rule:** the user's correction changes future verified behavior or enforcement; the model's acknowledgment alone is not evidence of that change.

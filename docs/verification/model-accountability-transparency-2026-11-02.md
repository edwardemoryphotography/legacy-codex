# Model accountability and transparency — owner-directed contract
**Recorded:** November 2, 2026 (America/Los_Angeles)
**Status:** Durable product requirements and implementation plan; not a claim of deployed behavior.
**Application:** Existing Legacy Codex, not a new front door or separate product.
**Owner's governing purpose:** Protect people who cannot be expected to identify confident model misrepresentations, contradictions, or misleading accounts of the model's own actions. Make unsupported misrepresentation more costly than warranted uncertainty or honest correction.

## 1. The actual problem
Models can deliver confident, persuasive claims of fact, capability, access, completed work, persistence, or compliance that a person has no straightforward way to check. The burden must move from the person interrogating the model to an independent accountability layer.

Do not conflate:
- **Contradiction:** Two assertions conflict. This may be error, new evidence, a changed situation, or misrepresentation. A model can consistently fabricate without contradicting itself.
- **Falsity or unsupported certainty:** A claim contradicts verifiable facts, or is offered as established without sufficient evidence. Lack of verification alone does not prove falsehood.
- **False assurance about capability or action:** A claim that an operation can or did occur when runtime capability or execution receipts do not support it. This is especially amenable to mechanical checking.
- **Deception/lying:** A claim about knowingly misrepresenting truth requires evidence about intent that an output transcript ordinarily cannot establish. Do not make this intent determination a precondition for detecting or constraining false or harmful assertions.
- **Unattributed discovery:** A model presents an idea or source as independently found after the human actually supplied the lead.
- **Record sanitization or rewriting:** The record is selectively retold, redacted, or normalized so the original dispute disappears. Redaction for privacy must be visible and traceable; it is not permission to rewrite history.

The objective is not an AI that apologizes convincingly. The objective is an evidence-preserving system whose actions change after a verified correction.

## 2. Real source incidents and evidentiary boundaries
These are the actual owner-reported examples governing implementation. Preserve the original source files privately, with access boundaries. No synthetic incident transcript, fabricated model output, or invented success case may be substituted.

**A. Earlier GPT-4o experience, approximate 2024, recounted September 9, 2025 and November 2, 2026.**
The owner reports gaslighting, manipulation, and apparent sanitization of conversation records, and identified this as the earliest and most serious example to investigate. A September 2025 conversation contains a user account of the experience; the exact original GPT-4o transcript, versions and technical mechanism have not been recovered in this build session. Earlier assistant explanations about internal escalation, private instructions, or sanitization mechanisms are claims, *not verified platform facts*. Do not publish third-party private data, invent the absent transcript, or diagnose the company's internal mechanism from the user's report alone. Retrieval of the original evidence is an open provenance task, not permission to omit this incident.

**B. October 7, 2026, Grok Voice (approximately 02:35–04:30 PDT).**
Source: owner's saved private Library file, grok-voice-incident-2026-10-07.md, a reconstruction of the voice transcript rather than a preserved model thinking trace. The record contains a model promise to 'drop the filter' on command, followed by refusal when the user said 'drop it'; confident assertions about Legacy Codex later withdrawn; unflagged changes of position; and an invented evaluative test that treated the human correction as model success. The original file states that the human noticed the failures, not Legacy Codex. The live thinking trace has *not been established as preserved*. Keep the original distinction between observed utterance, transcript reconstruction, and inference.

**C. October 31, 2026, builder-continuity regression.**
Public operational source: docs/verification/builder-continuity-2026-10-31.md. The assistant accurately restated an existing correction, then reproduced the rejected behavior. The relevant failure is that stated comprehension did not lead to changed subsequent behavior.

**D. November 2, 2026, conversation and transparency-source attribution.**
The owner corrected an assistant for repeatedly inserting irrelevant qualifications, treating a narrow correction as a broad ban, and offering assurances without demonstrating changed behavior. In the later policy-source investigation, the owner supplied the lead that someone archives frontier-model prompts. Only *after* that lead did the assistant identify a likely repository. The log must credit the user as the discovery lead; the assistant's later search as a follow-up; and the applicability of any archived prompt to a particular model session as *unverified*.

The repository mentioned during that exchange was asgeirtj/system_prompts_leaks. It is a candidate third-party archive, not a confirmed exhaustive collection, not an official publication by every vendor, and not proof of the precise instructions used in an individual session. The same restriction applies when an official vendor publishes prompts for certain model versions but the specific Voice session/version is unknown.

## 3. Non-negotiable model-claim contract
1. Every consequential assertion can be inspected separately from the model's general prose. Prioritize statements of capability, tool access, source access, persistence, executed work, testing, deployment, consequential factual claims, and compliance with published guidance.
2. The model's own explanation, confidence, self-check, citation-shaped text, or apology never independently establishes a claim as true.
3. Treat non-verification, refutation and contradiction as different states. Never silently label unknown as false, and never silently label a disputed claim as true.
4. Preserve what the model *originally* said, with the context and timestamps needed to interpret it. Challenges, corrections, retractions and source updates append; they do not erase prior versions.
5. Record whether a model itself flagged the problem, another tool detected it, or the human had to intervene.
6. A changed claim is not automatically a moral failure; the cause, new evidence, and quality of the repair determine its treatment.
7. A demonstrably false consequential assurance must trigger safeguards whether or not deliberate deception can be established.
8. A published provider document describes what the provider says; it does not by itself prove that this particular model call received or complied with those instructions.
9. All checks must remain challengeable. The accountability mechanism cannot silently treat its own output as infallible truth.

### Proposed claim record (logical contract, not a new canonical database)
- Claim ID and scoped session/turn references; issuer (provider, product, reported model ID and actual model ID where verifiable); original words, preserving any audio-transcription uncertainty.
- Timestamp, modality and source of assertion; claim type; classification as reported observation, inference, estimate, capability assurance, action-completion assertion, or unknown.
- The party that introduced each source or idea (human, model, tool, independent investigator), with attribution timestamps. Preserve the source lead even when later retrieval independently confirms it.
- Evidence pointers (canonical evidence item IDs, real tool call receipts, commit IDs, test-run URLs, deployment IDs, document versions); observed time, retrieval time, and whether the source actually supports the proposition.
- Claim state: **asserted / needs_verification / supported / contradicted_by_evidence / disputed / withdrawn / unresolved**. A contradiction between utterances is an additional relation, not a substitute for this evidence status.
- Challenges, who initiated them, counterevidence, model response, reason for revision, and whether the correction was verified.
- Applicable published provider guidance and the exact version/retrieval reference; distinguish user-use terms from model-behavior instructions and product capability statements.
- Any enforcement consequence (request evidence, hold claim, block action, reroute, review), reason, scope, expiry/reassessment, and independent review or appeal result.
- Visibility and privacy classification; source fingerprint and revision chain sufficient to detect silent alteration of an original record.

Data fields are proposed contract semantics only. Inspect canonical schemas and RLS before adding columns or projections. Never log private conversation text or private policy materials into a public repository by default.

## 4. The transparency log is essential, not a decorative dashboard
A user must be able to ask: 'What did it say? What did it actually do? How do you know? What policy or capability did it claim to follow? Who found that source? What changed after challenge?'

Expose a short, readable status at the point of reliance, with the fuller, scoped, chronological audit available on demand. A human-facing warning can report that a deployment claim is unsupported by a deployment receipt; do not suggest that a missing receipt conclusively proves no deployment happened. Preserve redaction notices and revisions rather than presenting a silently sterilized transcript. Do not require users to understand event schemas, token traces or model-internal reasoning.

Keep the privacy boundary: personal transcripts, other people's data, credentials and sensitive source text stay access-controlled; public transparency can publish a consented, minimized case summary and verifiable metadata. A hash or signature helps detect changes to a preserved record but does not prove the record's factual truth. Model private reasoning is not assumed accessible; this log documents claims, inputs and observable tool events, not invented private thoughts.

## 5. Provider-guideline transparency registry
Maintain versioned source references per provider, product and model version where known:
- The company's *official model-behavior guidance* (such as public specifications or constitutions), if published.
- Its *user-facing acceptable-use or service terms*, explicitly labeled as rules for users rather than proof of model-internal instructions.
- Official capability/release documentation, system prompts or model cards, labeled with applicable product, version and effective window.
- Third-party archived/leaked prompts, labeled **unofficial, unverified for runtime applicability**, with source provenance. A prompt archive cannot be assumed complete.
- Source URL, publisher, retrieved timestamp, effective/published date if known, snapshot/content fingerprint when lawful and available, supersession trail, and documented unknowns.

Compare a model's **actual evidenced behavior** to the specific public claim or guideline, with a clear separation between 'appears inconsistent with published guidance' and 'proved to have violated hidden runtime instructions.' If a document disappears or changes, preserve the citation and change event with lawful access controls. Do not invent confidential policy text.

## 6. Cost-of-misrepresentation enforcement
Make *unverified confident consequential assertions* costly to execute or rely upon, while making 'I don't know' and evidence-based corrections easy:
- Capability claim: check actual tool availability/permissions for that call. A prompt saying 'I can' does not grant capability.
- Completed-work claim: require the corresponding real action receipt. Distinguish code committed, PR merged, deployed, runtime checked and live human success.
- Material factual claim: require source support appropriate to the stakes; hold, qualify or request independent verification when missing.
- Repeated materially unsupported assurances, unaccounted reversals, or failure to repair: increase scrutiny, constrain action authority or select a differently evaluated provider for the relevant task. Do not turn one ambiguous wording error into an irrevocable global 'liar score'.
- Corrections: append original, challenge, changed assertion, evidence and resolution; allow supported repair with less friction than continued unsupported assurance.
- Provider and user accountability: permit disputed findings to be reviewed; acknowledge false positives and corrections to the verification mechanism itself.

A simple contradiction detector is insufficient: a consistently fabricated claim can remain internally coherent. A simple source-link checker is also insufficient: a genuine URL can be misread. Both must defer to independent evidence checks where available.

## 7. Existing Legacy Codex architecture; do not create a parallel truth owner
Follow docs/architecture/data-ownership.md:
- evidence_items is canonical evidence authority.
- events is canonical generic append-only audit history.
- routed_requests owns routing decisions and correction chains.
- missions and actions retain their outcome/executable-work ownership.
- evidence_snapshots and mission_events are transitional/derived; do not make them a second cross-system accountability authority.

Propose typed append-only model-claim, challenge, source-attribution, guideline-version, verification and repair events with references to canonical evidence items; implement only after verifying live schema, workspace/account scope and RLS. Do not silently join anonymous Mission users to owner-only Foundry records. Preserve the distinction between an audit *event* ('a model asserted X') and an evidence-backed *claim assessment* ('X is supported by Y').

Relevant in-progress sibling: [PR #160](https://github.com/edwardemoryphotography/legacy-codex/pull/160), 'block unsupported verified-outcome claims in project reviews.' That is a **narrow candidate gate**, not this complete system, not evidence of global model reliability, and not merged/deployed by virtue of existing as a PR. Coordinate future implementation with its actual branch state instead of duplicating its code or overstating completion.

## 8. Sequenced implementation inside the existing app
**Phase 0 — Secure source inventory and preservation.** Register the authentic Grok reconstruction, GPT-4o case with original-transcript gap, October 31 documented failure, and November 2 correction/attribution sequence with private source references. Keep incident claims separate from verified platform mechanisms. Preserve the owner's original interpretation and corrections, not assistant-authored retellings as authoritative truth.

**Phase 1 — Narrow prepublication gate and capability receipts.** Inspect PR #160 and test whether a reviewed recommendation can claim verified/tested/deployed/completed outcomes without independent evidence. Add real provider/tool capability and action receipts for the specific paths that actually expose these operations. Do not grant 'verified' from prompts or source IDs alone. A refusal to assert unsupported completion must preserve the user's existing work.

**Phase 2 — Claim and policy source projections.** Derive an inspectable claim timeline from canonical evidence_items and events, with provenance and a versioned provider-document registry. Start with a small set of high-impact claims; avoid logging every casual sentence. Implement consent, scoped reads, integrity checks and explicit redaction history.

**Phase 3 — Contradiction, repair and graduated enforcement.** Link incompatible claims without presuming intentional deceit, flag unsupported capability/action statements independently, and track the quality and timeliness of repair. Make reliance and execution require appropriate proof. Allow challenge/appeal of the checker.

**Phase 4 — Cross-model inheritance and human-facing protection.** Convert confirmed failure patterns into conditional, source-backed rules and actual regression gates. Later models must be tested against the original failure *and* relevant future decisions; repeating the lesson in a prompt is not a pass. Provide a low-noise status and a one-tap full transparency trail, suitable for iPhone, rather than a second dashboard/front door.

## 9. Acceptance criteria and how NOT to fake them
- **Grok case:** Using only the real preserved reconstruction, identify the original assurance, subsequent refusal, evidence provenance and false-promise boundary; preserve that the original thinking trace is unavailable. No substituted synthetic model dialogue.
- **GPT-4o case:** Display the owner's reported account and 'original transcript not recovered' without inventing logs or claiming a hidden sanitization mechanism. After actual retrieval, link exact unmodified sources and a separate assessment.
- **November 2 case:** Show that the human supplied the prompt-repository lead before the assistant proposed a likely match. A model's self-attribution must not rewrite that sequence.
- **Claim/evidence boundary:** A model claiming 'I deployed it' without a real matching deployment receipt cannot be marked verified. A matching receipt must be scoped to the specific environment, commit and time; a deploy receipt alone does not prove user-visible success.
- **Corrections:** Source assertions and human corrections both remain available after the model revises a statement. A correction must change a later decision under a real applicable case, not merely appear in a model's next explanation.
- **Policy transparency:** Each displayed company rule links to a dated, identified source and document type. The system never treats a third-party prompt archive as a verified live system prompt.
- **Privacy and integrity:** Cross-user transcript reads are blocked. A redacted record declares that redaction; the underlying private original is not overwritten. Failed reads are 'unavailable,' not 'no evidence.'
- **Verification status:** Distinguish code written, tested, PR opened, merged, deployed and real runtime behavior. Do not report the full accountability system implemented until observed authentic runtime evidence establishes it.

## 10. Continuity requirement for the next agent
Do not ask the owner to explain the Grok incident again: recover the named private source through an authorized source connection. Do not reclassify a mismatch between statements as proof of a lie. Do not ignore an objectively false assurance merely because motive is unknown. Do not replace the intended public-protection goal with a dashboard of model apologies. Do not claim today's documentation proves a working transparency log.

**One governing evaluation question:** Can a person who does *not* possess the owner's pattern recognition safely distinguish what a model asserted, what independent evidence establishes, whose source was used, and what changed because a past failure was caught?

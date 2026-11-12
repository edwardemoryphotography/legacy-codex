import { INCIDENT_CANDIDATES, casebookEvidenceLayers, renderEvidenceLayers, renderIncidentCandidate } from './incidentCandidates'

// Public-safe historical evidence index. Not a persisted, human-confirmed
// lesson store, and not a model instruction stream. Private origin content is
// deliberately NOT copied into this public repository.
export type BoomerangRecordStatus = 'origin-documented' | 'engineering-documented' | 'candidate' | 'user-verified-fix'
export type BoomerangEvidence = { label: string; access: 'public' | 'restricted'; url?: string }
export type BoomerangCase = {
  id: string
  era: string
  title: string
  sourceDomain: string
  targetDomain: string
  sharedStructure: string
  reasoningBridge: string
  practicalConsequence: string
  evidenceRequired: string
  recordStatus: BoomerangRecordStatus
  inheritance: 'not-demonstrated'
  sources: readonly BoomerangEvidence[]
}

export const BOOMERANG_CASES: readonly BoomerangCase[] = [
  {
    "id": "BR-001",
    "era": "2025-11",
    "title": "Challenge agreeable answers",
    "sourceDomain": "Original November session: a model's agreeable interpretation was challenged",
    "targetDomain": "Later agent recommendations and product claims",
    "sharedStructure": "Confidence and agreement cannot substitute for an accurate conclusion",
    "reasoningBridge": "Both the first answer and future recommendations can sound persuasive while hiding an untested premise",
    "practicalConsequence": "Require alternatives, limitations, and evidence checks before adopting consequential claims",
    "evidenceRequired": "Observe a later relevant answer correct an unsupported assumption without the owner challenging it again",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "Builder continuity correction",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-002",
    "era": "2025-11",
    "title": "Chronology changes meaning",
    "sourceDomain": "An early correction distinguished an event from the later analysis of that event",
    "targetDomain": "Project histories, provenance, retrospectives",
    "sharedStructure": "Sequence and causal interpretation depend on exact event time and interpretation time",
    "reasoningBridge": "When the timeline changed, the explanation of how an idea emerged changed too",
    "practicalConsequence": "Keep event, discovery, documentation, and deployment dates separate",
    "evidenceRequired": "Reconstruct a later event with correctly distinguished times from its sources",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      }
    ]
  },
  {
    "id": "BR-003",
    "era": "2025-11",
    "title": "Drift detection is part of reasoning",
    "sourceDomain": "An apparent content strategy drifted away from its original question",
    "targetDomain": "Long-running human-AI projects and autonomous agents",
    "sharedStructure": "A locally productive thread can violate the governing goal",
    "reasoningBridge": "The user noticed objective drift before a polished but irrelevant answer became the deliverable",
    "practicalConsequence": "Recheck the original outcome whenever suggestions multiply or context shifts",
    "evidenceRequired": "Later agent identifies and corrects drift before being reminded",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-004",
    "era": "2025-11",
    "title": "The end state precedes the medium",
    "sourceDomain": "A requested post exposed a deeper need to translate ideas into usable infrastructure",
    "targetDomain": "Website, app, newsletter and agent design choices",
    "sharedStructure": "The surface artifact is not necessarily the real outcome",
    "reasoningBridge": "A post was one possible vehicle; the governing goal was a reusable way to preserve and execute thinking",
    "practicalConsequence": "Infer the durable outcome before choosing its container",
    "evidenceRequired": "A fresh brief receives a fitting product form without assuming the original medium",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-005",
    "era": "2025-11",
    "title": "Distribution is not preservation",
    "sourceDomain": "An assumed publishing platform was irrelevant to the purpose of the original document",
    "targetDomain": "Long-term reference, learning and cross-agent continuity",
    "sharedStructure": "Reach and durable retrievability optimize for different things",
    "reasoningBridge": "A shareable channel might circulate a lesson yet fail to keep it findable and reconstructable later",
    "practicalConsequence": "Give canonical references stable ownership; treat platforms as distribution surfaces",
    "evidenceRequired": "A future handoff finds the governing source after the original channel disappears",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-006",
    "era": "2025-11",
    "title": "The conversation is part of the artifact",
    "sourceDomain": "The original session's challenge–reflection–correction cycle was reconstructed into seven phases",
    "targetDomain": "Agent onboarding, teaching and future collaboration",
    "sharedStructure": "The process that generates a sound result can itself be transferred",
    "reasoningBridge": "Extracting critical turns made the collaboration reproducible beyond the specific output",
    "practicalConsequence": "Preserve the decision/correction mechanism, not just the final answer",
    "evidenceRequired": "A fresh agent follows the phases on unrelated real work without a complete replay",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-007",
    "era": "2025-11",
    "title": "Work backward from prerequisites",
    "sourceDomain": "An unrealized creative workshop ambition revealed the gap between a clear destination and the infrastructure needed to reach it",
    "targetDomain": "Mission planning and feasible next actions",
    "sharedStructure": "Seeing the end state does not mean execution prerequisites already exist",
    "reasoningBridge": "Both creative production and software delivery require concrete dependencies before the finish line can be claimed",
    "practicalConsequence": "Derive the next feasible move backward from explicit acceptance criteria and real constraints",
    "evidenceRequired": "A later project surfaces a missing prerequisite before committing an infeasible plan",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/nextaction-contract-2026-11-03.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/nextaction-contract-2026-11-03.md"
      }
    ]
  },
  {
    "id": "BR-008",
    "era": "2025-11",
    "title": "Teach the method, not only the result",
    "sourceDomain": "The original archive identified stories, people, artifacts and structures as different means of transmission",
    "targetDomain": "Knowledge handoffs, mentoring and Legacy Relay",
    "sharedStructure": "A valuable outcome becomes more reusable when its generating method can be inherited",
    "reasoningBridge": "The same human insight can travel through distinct representations if its conditions and reasoning survive",
    "practicalConsequence": "Preserve a clear operating rule and its boundaries rather than only an example",
    "evidenceRequired": "An independent recipient makes a better decision without reenacting the original difficulty",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Nov 2–3, 2025 owner session archive (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-009",
    "era": "2026-08",
    "title": "The build became the explanation",
    "sourceDomain": "Implementation accumulated routing, evidence, corrections, persistence and product boundaries",
    "targetDomain": "Reconstructing the creator's higher-order intent from code and artifacts",
    "sharedStructure": "Many independent consequences can reveal the latent architecture that produced them",
    "reasoningBridge": "Read the same artifact graph forward from intent and backward from implementation; compare reconstructed invariants",
    "practicalConsequence": "Run bidirectional reconstruction before declaring a major vision change",
    "evidenceRequired": "A fresh agent reconstructs the established North Star solely from supported artifacts",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Aug 9, 2026 origin conversation (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-010",
    "era": "2026-08",
    "title": "Clearer evidence is not a changed vision",
    "sourceDomain": "The receiving model interpreted old intent differently once the implementation became legible",
    "targetDomain": "Historical product narratives and later model sessions",
    "sharedStructure": "Observability of intent is distinct from evolution of intent",
    "reasoningBridge": "A clearer explanation can be mistaken for a newly expanded objective",
    "practicalConsequence": "Separate genuine owner decisions from later improved reconstruction",
    "evidenceRequired": "A cold-start agent identifies the same governing outcome without inventing a pivot",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Aug 9, 2026 origin conversation (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-011",
    "era": "2026-08",
    "title": "Preserve learned capability, not all history",
    "sourceDomain": "The live goose analogy compressed a recursion and inheritance pattern",
    "targetDomain": "Cross-session agent knowledge and durable rules",
    "sharedStructure": "Useful legacy is what future decisions can inherit, not maximum transcript storage",
    "reasoningBridge": "The metaphor and software both carry information forward only if the lesson survives in operative structure",
    "practicalConsequence": "Propose rule → confirm provenance/conditions → change a relevant future decision",
    "evidenceRequired": "An unrelated real task improves without re-supplying the original correction",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Aug 9, 2026 origin conversation (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-012",
    "era": "2026-08",
    "title": "A distant analogy can be a compressed theorem",
    "sourceDomain": "A sudden comparison to migrating geese expressed the same feedback structure being discussed",
    "targetDomain": "Reasoning over unrelated business, code and human experiences",
    "sharedStructure": "Different domains may instantiate the same higher-order relation",
    "reasoningBridge": "The missing bridge must be decompressed from source → target → invariant, not guessed from shared keywords",
    "practicalConsequence": "Treat surprising analogies as hypotheses; test them against evidence and rival explanations",
    "evidenceRequired": "A novel source/target pair yields a justified and actionable bridge, or a defensible rejection",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Aug 9, 2026 origin conversation (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-013",
    "era": "2026-08",
    "title": "MasterChef means applying, not repeating",
    "sourceDomain": "The Goose Cookbook was declared standing doctrine across builders",
    "targetDomain": "Future agents presented with new and different conditions",
    "sharedStructure": "Reading instructions is not demonstrated competent execution",
    "reasoningBridge": "A model can quote a recipe without performing the cross-domain reconstruction it demands",
    "practicalConsequence": "Require the next agent to demonstrate the cognitive move on fresh real material",
    "evidenceRequired": "Fresh-instance test shows the actual bridge and its practical consequence",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-014",
    "era": "2026-08",
    "title": "Misunderstanding becomes requirements",
    "sourceDomain": "Repeated local misreadings forced additional interfaces, rules and proofs",
    "targetDomain": "Requirements discovery and human–AI product design",
    "sharedStructure": "A correction can expose a missing structural support rather than just a bad answer",
    "reasoningBridge": "Each failure to reconstruct intent showed which representation or constraint had not survived",
    "practicalConsequence": "Turn corrected misreadings into tests, interfaces or durable constraints",
    "evidenceRequired": "A different agent no longer repeats the same misinterpretation",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Aug 9, 2026 origin conversation (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-015",
    "era": "2026-08",
    "title": "Follow invariants across containers",
    "sourceDomain": "An initial documentation search missed the Goose origin by following product-title files but not repository cross-references",
    "targetDomain": "Research, archaeology and agent memory retrieval",
    "sharedStructure": "High-value causal evidence can live outside the obvious named corpus",
    "reasoningBridge": "The repeated outcome was visible in documents, but its origin lived in linked doctrine",
    "practicalConsequence": "Search by behavior, cross-reference and invariant before declaring a corpus complete",
    "evidenceRequired": "A later cross-repository synthesis locates the governing source without the owner naming its file",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-016",
    "era": "2026-08",
    "title": "Preserve meaning across representations",
    "sourceDomain": "The same intent appeared as language, schema, routing, UI and deployment rules",
    "targetDomain": "Human-to-agent and agent-to-agent transfers",
    "sharedStructure": "The representation can change while the underlying constraint stays invariant",
    "reasoningBridge": "A route, persisted action and visible interface serve different substrates of one human outcome",
    "practicalConsequence": "Verify intent/constraints survive each handoff, not merely that data arrived",
    "evidenceRequired": "An interrupted different-model agent resumes with the correct outcome and restrictions",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-017",
    "era": "2026-07–08",
    "title": "Separate the human product from builder operations",
    "sourceDomain": "Legacy Codex and Foundry repeatedly crossed navigation and responsibility boundaries",
    "targetDomain": "Single-front-door architecture and internal execution tooling",
    "sharedStructure": "Human goals and technical execution status must be linked but not conflated",
    "reasoningBridge": "Foundry's deployment/agent mechanics are evidence for Codex, not a replacement human-facing product",
    "practicalConsequence": "Keep Codex as the front door and Foundry as internal support",
    "evidenceRequired": "An owner can complete a human mission without needing to navigate builder internals",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/architecture/data-ownership.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/architecture/data-ownership.md"
      }
    ]
  },
  {
    "id": "BR-018",
    "era": "2026-08",
    "title": "Mission, Action and Evidence own different truths",
    "sourceDomain": "A live Mission migration disagreed with an earlier canonical data decision",
    "targetDomain": "Database ownership and decision provenance",
    "sharedStructure": "Implemented tables are not automatically canonical meaning",
    "reasoningBridge": "The shipped schema did not alone authorize redefinition of outcomes, executable work or evidence",
    "practicalConsequence": "Preserve Mission=outcome, Action=work, evidence_items=atomic evidence, events=audit",
    "evidenceRequired": "New flows use one canonical owner for each concept without parallel truth",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/architecture/data-ownership.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/architecture/data-ownership.md"
      }
    ]
  },
  {
    "id": "BR-019",
    "era": "2026-08",
    "title": "Merged is not Live",
    "sourceDomain": "A successful deploy notification arrived amid recurring Vercel/Supabase incidents",
    "targetDomain": "Shipping claims, CI and runtime trust",
    "sharedStructure": "Each rung of completion needs independent evidence",
    "reasoningBridge": "Code merge, hosted build, runtime request and actual human acceptance test different things",
    "practicalConsequence": "Report Merged → Deployed → Runtime Verified → Live separately",
    "evidenceRequired": "A future release cannot be called live from a green build alone",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/58",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/58"
      }
    ]
  },
  {
    "id": "BR-020",
    "era": "2026-08",
    "title": "Verification discovers hidden defects",
    "sourceDomain": "A live RLS correction revealed a second grants problem during verification",
    "targetDomain": "Security repair and deployment gating",
    "sharedStructure": "Checking the fix can expose adjacent invariant violations that the original patch missed",
    "reasoningBridge": "The verification step changed the actual hardening outcome rather than merely approving it",
    "practicalConsequence": "Test permissions and neighboring boundaries after the first repair",
    "evidenceRequired": "Production read/write permissions satisfy the exact owner and role contract",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/58",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/58"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/architecture/data-ownership.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/architecture/data-ownership.md"
      }
    ]
  },
  {
    "id": "BR-021",
    "era": "2026-08",
    "title": "Current truth needs a dated lineage",
    "sourceDomain": "Historical plans were stale while operational state had changed",
    "targetDomain": "Canonical docs and long-running agent plans",
    "sharedStructure": "Preserving history and reflecting current reality are compatible",
    "reasoningBridge": "Overwriting the old plan hides provenance; blindly following it creates regressions",
    "practicalConsequence": "Append reconciliation with verified date/source instead of silently rewriting history",
    "evidenceRequired": "A later agent honors current state and can still reconstruct prior decisions",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-022",
    "era": "2026-08",
    "title": "One canonical doctrine, many agents",
    "sourceDomain": "The Goose principle needed distribution to different coding agents",
    "targetDomain": "Model routing and cross-tool work",
    "sharedStructure": "Duplicated paraphrases drift; one reviewable authority can travel across tools",
    "reasoningBridge": "Shared source and reviewed projections preserve the same instruction across different model contexts",
    "practicalConsequence": "Keep Goose Cookbook canonical; test its projections and handoff inheritance",
    "evidenceRequired": "A fresh builder receives and applies the same owner intent without a custom retelling",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-023",
    "era": "2026-09–10",
    "title": "Resume the commitment, not the chat",
    "sourceDomain": "Persistent actions, correction chains and unfinished mission recovery were developed separately",
    "targetDomain": "Interrupted work across browser and agent sessions",
    "sharedStructure": "Continuity requires executable state plus why and what remains",
    "reasoningBridge": "A stored transcript alone cannot reveal the exact unfinished action or its constraints",
    "practicalConsequence": "Resume from canonical action identity, notes, constraints and evidence",
    "evidenceRequired": "Real save → interrupt → reload → resume repeats the chosen work without losing the owner outcome",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/nextaction-contract-2026-11-03.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/nextaction-contract-2026-11-03.md"
      }
    ]
  },
  {
    "id": "BR-024",
    "era": "2026-10",
    "title": "Acknowledgment is not downstream repair",
    "sourceDomain": "An assistant could acknowledge a correction while leaving dependent conclusions unchanged",
    "targetDomain": "Claim integrity and learning from failed conversations",
    "sharedStructure": "A revision only matters when it updates affected decisions",
    "reasoningBridge": "A plausible explanation or apology can coexist with the original harmful recommendation",
    "practicalConsequence": "Trace original claim → correction → dependent outputs → next relevant behavior",
    "evidenceRequired": "On a new real case the dependent action changes without repeated owner intervention",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Oct 7, 2026 MasterChef account (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-025",
    "era": "2026-10",
    "title": "Carry discernment with care",
    "sourceDomain": "Teaching from mistakes aimed to spare a future person the avoidable struggle",
    "targetDomain": "Legacy Relay and owner-to-recipient learning",
    "sharedStructure": "Transfer useful judgment without copying authority or replaying hardship",
    "reasoningBridge": "A valuable lesson must include why/when it applies and preserve the recipient's agency",
    "practicalConsequence": "Transmit provenance, boundaries and the right to challenge rather than demand trust",
    "evidenceRequired": "A consenting recipient reconstructs and uses the lesson independently on a relevant real problem",
    "recordStatus": "origin-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Oct 7, 2026 MasterChef account (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md"
      }
    ]
  },
  {
    "id": "BR-026",
    "era": "2026-10",
    "title": "Do not confuse claims with their verification",
    "sourceDomain": "A reported model explanation, a visible artifact, a deployed component and a self-check had been conflated",
    "targetDomain": "AI accountability and engineering review",
    "sharedStructure": "Reported, observed, inferred, implemented and independently verified are different states",
    "reasoningBridge": "An explanation of a failure is another evidence-requiring claim; a retraction needs justification",
    "practicalConsequence": "Keep contestable claim/evidence chains, repair impacted decisions, and never penalize justified correction",
    "evidenceRequired": "An independent review identifies unsupported premises before acting",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "Oct 7, 2026 MasterChef account (restricted Notion source)",
        "access": "restricted"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/claim-integrity-2026-11-02.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/claim-integrity-2026-11-02.md"
      }
    ]
  },
  {
    "id": "BR-027",
    "era": "2026-10",
    "title": "Three pages must not become five",
    "sourceDomain": "A real external user's three-page assignment received a five-page writing budget",
    "targetDomain": "Any generated quantity plan: pages, slides, words, minutes or hours",
    "sharedStructure": "Declared numeric constraints must be enforced on the resulting output",
    "reasoningBridge": "Saving a requirement is not sufficient when the recommendation stage silently violates it",
    "practicalConsequence": "Validate output quantities and unit types against the real finish line",
    "evidenceRequired": "A later unrelated real quantity-constrained task produces compliant output without repeating the correction",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/122",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/122"
      }
    ]
  },
  {
    "id": "BR-028",
    "era": "2026-10",
    "title": "Every output path must respect known truth",
    "sourceDomain": "First external-use defects included stale resume state, screen overflow and non-atomic Primary transitions",
    "targetDomain": "User-interface, database and generative output validators",
    "sharedStructure": "Different layers can silently or loudly violate already-declared facts",
    "reasoningBridge": "The Primary switch, stored place, screen bounds and page budget all needed end-to-end invariants",
    "practicalConsequence": "Make current constraints observable and check outputs before presentation or writes",
    "evidenceRequired": "Fresh cases respect saved position, one Primary, viewport and declared deliverable bounds",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/118",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/118"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/119",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/119"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/120",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/120"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/121",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/121"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/122",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/122"
      }
    ]
  },
  {
    "id": "BR-029",
    "era": "2026-10",
    "title": "Evidence-based structural similarity is not lexical overlap",
    "sourceDomain": "Earlier related-project retrieval preferred shared words while Goose required hidden structural matches",
    "targetDomain": "Cross-project review and later decisions",
    "sharedStructure": "Similarity of causal relationships matters more than matching vocabulary",
    "reasoningBridge": "A well-grounded connection needs source IDs, quotes, bridge, counterexample and a test",
    "practicalConsequence": "Retrieve independent candidates and label proposed bridges separately from validated lesson inheritance",
    "evidenceRequired": "A genuinely different project receives a relevant source-grounded recommendation without fresh owner cue",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/116",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/116"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/structural-transfer-2026-10-16.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/structural-transfer-2026-10-16.md"
      }
    ]
  },
  {
    "id": "BR-030",
    "era": "2026-10–11",
    "title": "A review is not a learned rule",
    "sourceDomain": "Project Review could draft lessons but production had no confirmed lesson records",
    "targetDomain": "The Codex learning ledger and future model requests",
    "sharedStructure": "A proposal, confirmed rule, retrieved context and changed behavior are separate stages",
    "reasoningBridge": "Writing a lesson into a prompt cannot establish transfer of intelligence",
    "practicalConsequence": "Require confirmation, scope, provenance, retirement and a later behavior comparison",
    "evidenceRequired": "A human-confirmed rule influences a later real decision and the difference is independently inspected",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/structural-transfer-2026-10-16.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/structural-transfer-2026-10-16.md"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/src/app/api/delta-lessons/route.ts",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/src/app/api/delta-lessons/route.ts"
      }
    ]
  },
  {
    "id": "BR-031",
    "era": "2026-10–11",
    "title": "The interface must tell the truth about cognition",
    "sourceDomain": "A visual orb and product status risked suggesting progress from decoration alone",
    "targetDomain": "Ambient UI, learning indicators and deploy status",
    "sharedStructure": "Visual representations must be consequences of observable state",
    "reasoningBridge": "A beautiful animation is not evidence of reasoning, transfer or completion",
    "practicalConsequence": "Bind cognitive visuals and status to real events; reserve boomerang signals for evidenced application",
    "evidenceRequired": "A user sees only state backed by a traceable runtime event",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/src/components/CodexOrb.tsx",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/src/components/CodexOrb.tsx"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/structural-transfer-2026-10-16.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/structural-transfer-2026-10-16.md"
      }
    ]
  },
  {
    "id": "BR-032",
    "era": "2026-10",
    "title": "A known doctrine must govern the next build",
    "sourceDomain": "A builder rediscovered the August Goose insight and required the owner to re-explain it",
    "targetDomain": "Future agent onboarding and product evolution",
    "sharedStructure": "Stored instructions do not help if the agent fails to orient from the authoritative sources",
    "reasoningBridge": "The lapse repeated the same missing-reconstruction error the Cookbook was written to prevent",
    "practicalConsequence": "Retrieve governing source graph before interpretation and encode the failure as a check",
    "evidenceRequired": "A fresh agent applies existing doctrine without reframing it as a new user vision",
    "recordStatus": "engineering-documented",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/builder-continuity-2026-10-31.md"
      }
    ]
  },
  {
    "id": "BR-033",
    "era": "2026-11",
    "title": "Outside users test assumptions that builders cannot",
    "sourceDomain": "First outside-user testing produced real interaction evidence distinct from internal green builds",
    "targetDomain": "Self-improving Codex's Primary mission and product acceptance",
    "sharedStructure": "A product's utility depends on independent humans successfully using it",
    "reasoningBridge": "The abandoned tester effort and the improvement mission share a need for external disconfirming evidence",
    "practicalConsequence": "Route genuine outside-user observations into prioritization and acceptance",
    "evidenceRequired": "A new person completes a real task and the result changes a later product decision",
    "recordStatus": "candidate",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/118",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/118"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/nextaction-contract-2026-11-03.md",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/blob/main/docs/verification/nextaction-contract-2026-11-03.md"
      }
    ]
  },
  {
    "id": "BR-034",
    "era": "2026-11",
    "title": "Replace an invalid structure, do not endlessly offset it",
    "sourceDomain": "Three attempts to patch a clipped iPhone tool flyout failed in different browser contexts",
    "targetDomain": "Other UI, workflow and agent-system failures that recur after local workarounds",
    "sharedStructure": "Repeated symptom fixes can be evidence that the containing relationship is wrong",
    "reasoningBridge": "An absolutely positioned menu inside a clipped dock remained fragile; the browser-native top-layer dialog escaped that constraint",
    "practicalConsequence": "Investigate the containing architecture after repeated regressions and prefer the smallest structural replacement",
    "evidenceRequired": "Owner confirms a real new-device case; separate transfer to unrelated domains remains untested",
    "recordStatus": "user-verified-fix",
    "inheritance": "not-demonstrated",
    "sources": [
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/185",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/185"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/186",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/186"
      },
      {
        "label": "https://github.com/edwardemoryphotography/legacy-codex/pull/187",
        "access": "public",
        "url": "https://github.com/edwardemoryphotography/legacy-codex/pull/187"
      }
    ]
  }
] as const

function linkSource(source: BoomerangEvidence): string {
  return source.url ? `[${source.label}](${source.url})` : `${source.label} (not republished)`
}

// A single case becomes one navigable, searchable existing Codex child entry.
export function renderBoomerangRecord(record: BoomerangCase): string {
  return [
    `# ${record.id} — ${record.title}`,
    '',
    `**Era:** ${record.era}`,
    `**Documentary status:** ${record.recordStatus}`,
    '**Independent future lesson transfer:** not demonstrated',
    '',
    `**Source:** ${record.sourceDomain}`,
    '',
    `**Target:** ${record.targetDomain}`,
    '',
    `**Shared structure:** ${record.sharedStructure}`,
    '',
    `**Reasoning bridge:** ${record.reasoningBridge}`,
    '',
    `**Practical consequence:** ${record.practicalConsequence}`,
    '',
    `**Evidence still required:** ${record.evidenceRequired}`,
    '',
    `**Sources:** ${record.sources.map(linkSource).join(' · ')}`,
    '',
    '**Evidence, layer by layer (never one confidence score):**',
    renderEvidenceLayers(casebookEvidenceLayers(record)),
    '',
    ...INCIDENT_CANDIDATES.filter(candidate => candidate.casebookId === record.id).flatMap(candidate => [renderIncidentCandidate(candidate), '']),
    'A historical record is not a human-confirmed account lesson. Apply the existing Project Review workflow before treating this as transferable operating guidance.',
  ].join('\n')
}

// Searchable existing Codex → Root entry, never an invented learning-record write.
export function renderBoomerangCasebook(): string {
  return [
    '# Boomerang Casebook — historical catches and candidate bridges',
    '',
    'This public-safe casebook reconstructs documented discoveries from the recoverable November 2025–November 2026 corpus. It does not assert that every original handwritten note or conversation has been recovered.',
    '',
    '**Important:** Each record is historical source analysis, not a confirmed lesson in your account and not evidence of autonomous cross-project transfer. The human-confirmed learning ledger is separate. Candidate connections are hypotheses, not promises.',
    '',
    'The [canonical Goose Cookbook](https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md) remains the doctrine owner.',
    '',
    ...BOOMERANG_CASES.flatMap(record => [
      `## ${record.id} — ${record.title}`,
      `**Era:** ${record.era} · **Record status:** ${record.recordStatus} · **Future inheritance:** not demonstrated`,
      `- **Source:** ${record.sourceDomain}`,
      `- **Target:** ${record.targetDomain}`,
      `- **Shared structure:** ${record.sharedStructure}`,
      `- **Reasoning bridge:** ${record.reasoningBridge}`,
      `- **Practical consequence:** ${record.practicalConsequence}`,
      `- **Evidence required:** ${record.evidenceRequired}`,
      `- **Traceable sources:** ${record.sources.map(linkSource).join(' · ')}`,
      '',
    ]),
    '## Missing primary sources and promotion boundary',
    '- The owner reports earlier handwritten notes from 2015–2017 and earlier personal legacy material. Those originals were not in this examined corpus; do not invent them or treat a retrospective as direct proof of a specific original note.',
    '- A catch is not a confirmed `delta_lesson_confirmed` event. To promote a candidate, use an actual source-grounded Project Review, human confirmation with conditions and scope, and later independent outcome checks.',
    '- Do not silently inject this entire casebook into model prompts as if every entry were an owner-confirmed command. Investigate relevance and contradictions first.',
  ].join('\n')
}

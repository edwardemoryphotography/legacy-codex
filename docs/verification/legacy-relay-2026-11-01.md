# Legacy Relay — My ceiling becomes someone else's floor

**Origin:** Eddie's November 1, 2026 conversation, including his rediscovered June 10, 2021 handwritten journal note. No technology-building intention is retroactively attributed to his 2021 self. He was writing to turn mental static into understandable signal.

**Governing principle:** The point of asking younger friends to learn from his mistakes was not just sparing them pain; it was helping them use his years of experience to go further than he could at their age. The person who comes next starts on what the person before them learned. A relay should expand the recipient's agency, never prescribe their destination.

**Cathedral requirement:** The lesson must travel out of its source context and become relevant to the recipient's actual work; a beautiful graphic alone is not inherited capability. Retain the prior Goose Cookbook doctrine and this user's original intent.

## First implemented slice

1. A person with a **confirmed lesson** in Project Review explicitly taps **Pass this lesson forward**. The link encodes **only the rule, the condition, and any exceptions**. It carries no mission IDs, source records, other project artifacts, credentials or user identities. Sharing does not silently publish a record.
2. A recipient opens the same Legacy Codex app via the link; Mission opens its **Receive a shared lesson** panel. The exact words and limits are shown before anything is saved.
3. The recipient chooses **their own saved mission** and explicit **mission-only** or **across-my-missions** scope. The existing signed-in-user RLS checks bind the event to their own mission. A stable idempotency key prevents duplicate saves from retrying the same choice.
4. The append-only `mission_events` ledger holds the recipient-confirmed lesson, with `origin: 'relay'` and an explicit *unverified original source* status. Existing confirmed-lesson retrieval can then supply applicable lessons to eligible future project reviews. The recipient can retire a received lesson without deleting history. All reads and writes stay scoped to the signed-in account.

No new user-facing app, database table, service role, public listing, cross-account read access, or open AI endpoint is created. No source mission content is shared beyond what its owner chooses to put in the lesson wording. Anyone with the link can read its shared rule, conditions, and exceptions; this is voluntary text sharing, not secure document access, a signed credential, or verified attribution.

## Separate acceptance tests that cannot be inferred from code

- A real originating account has a human-confirmed saved lesson; the owner reviews wording and shares the link.
- A *different real person* opens it in their own active session, verifies the content and chooses their mission.
- That second person's event persists across reload; the original owner's project and evidence remain inaccessible.
- A later eligible model-assisted review on the recipient mission references the accepted lesson only under its conditions, while still making an independent recommendation.
- The recipient's actual next action and observed outcome demonstrate *whether* inheriting the lesson helped them go further. Do not claim a proven boomerang, causal improvement or successful autonomous transfer before this happens.

**Limits:** The first relay requires explicit human sharing and acceptance. It does not autonomously choose who should inherit a lesson, verify that a shared rule is true, enable owner-only AI access for other accounts, or prove that another user's real-world outcomes improved. Do not conflate receiving a rule with successful application.

**Canonical sources:** `src/lib/lessonRelay.ts`, `src/app/api/lesson-relay/route.ts`, `src/components/LessonRelayReceive.tsx`, `src/components/ProjectLearning.tsx`. Original Goose Cookbook remains the doctrine owner.

## November 12 exception-preservation repair

The review on [PR #189](https://github.com/edwardemoryphotography/legacy-codex/pull/189#discussion_r4546173463) found that incident exceptions were absent from Relay. The sharing UI omitted them, the old v1 format could not carry them, the receive route omitted them from persistence and reload, and the confirmed-lesson loader retained exceptions only for incident-origin records. That widened a rule during translation.

The repair uses `LC-RELAY-2` only for exception-bearing lessons; v1 links and their retry identity remain supported. v2 requires nonempty bounded exceptions and rejects a mismatched prefix or unknown fields. Request/code bounds cover the additional 800 characters without truncation. Preview, explicit recipient save, reload, subsequent learned context and resharing retain the exceptions. Invalid saved exceptions fail reconstruction instead of producing a broader rule. Nothing supplies a missing exception to an old v1 link retroactively; regenerate a share link from the complete originating lesson.

New regression checks use the actual public IC-001 candidate wording, not a fabricated confirmed lesson or recipient. They establish transport/serialization/limit-preservation contracts only. IC-001 remains a proposal until the owner confirms it. No new account, confirmation, recipient, outcome, production database record, schema, provider access, or synthetic evidence is created by this repair. A genuine two-person receive → reload → later appropriate application remains unverified.

Local gates on November 12: 663 tests passed, two live-source tests remained opt-in/skipped; TypeScript passed; lint had zero errors and 22 existing warnings; production build and builder/immersive/Economy checks passed. The new real-wording codec check failed on the original implementation before passing with v2. The initial full run exposed an obsolete 20 KB oversized-request assertion; it now follows the expanded bounded request limit. These results do not establish live receipt, database persistence under a real recipient identity, or later benefit.

Production release on November 12: [PR #190](https://github.com/edwardemoryphotography/legacy-codex/pull/190) merged as `595df31c05590bee3d4c9170b2cc16ba4c8b6fed`. [Hosted CI](https://github.com/edwardemoryphotography/legacy-codex/actions/runs/43317267488) and merged-main verification passed; the hosted code review reported no findings. The reviewed and merged application source trees match. Canonical frontend [deployment](https://vercel.com/edwardemoryphotographys-projects/frontend/FBSnpiFeh1UWJQyQnZavsFmz6BGW) is READY Production at that SHA, and canonical-domain lookup confirms it owns https://legacy-codex.vercel.app with no alias error. Root returned HTTP 200; unsigned GET to `/api/lesson-relay` returned 401. A ten-minute deployment-scoped error/fatal query returned no groups. These are release/boundary checks, not an authenticated receive workflow. A real recipient save → reload → later appropriate application remains unverified. No production lesson or account was created for verification.

# Immersive Intelligence Implementation Plan

**Goal:** Deliver the user's supplied immersive-experience specification inside the canonical Legacy Codex application.
**Architecture:** Keep PersistentOrb mounted once. Bound Home to the visual viewport, with a persistent orb stage, independently scrolling latest response/history, and an in-flow composer. Production appearance preferences control existing ambient tokens and WebGL uniforms. Typed text takes precedence over text-free tools. No backend ownership, auth, routing provider, or schema changes.
**Spec:** Eddie's November 1 execution assignment in this session is authoritative and explicitly opts out of another brainstorming/approval cycle.

## Constraints and review focus
- No fabricated activity, answers, mission records or verified-transfer signal.
- Preserve Mission, actions, owner authorization and provider chain.
- Verify small viewport, keyboard resizing, long output, cancellation/stale responses, appearance storage failure, and system reduced motion.
- One branch/PR and existing frontend production Git pipeline; no duplicate deployment project.

## Tasks
- [ ] Add deterministic failing contracts for state semantics, typed-question routing and appearance validation; run with Node's native TypeScript support (no dependency installation required).
- [ ] Implement pure presentation/request/preferences helpers; keep operation separate from model processing and Ember dormant.
- [ ] Adapt Home and PersistentOrb: bounded stage, independent readable response, session history via disclosure, actual capture states, cancellation retaining drafts, mission entry via disclosure.
- [ ] Replace preview-only ThemeReview with compact production Appearance; apply boot preferences before paint, live WebGL palette/motion and coherent ambient tokens.
- [ ] Add component and cancellation regressions using existing test infrastructure; run native contracts, hosted lint/types/full unit/build gates if local install is blocked.
- [ ] Obtain fresh whole-change review and address material findings. Recheck main before integration; merge only green checks. Inspect canonical READY deployment and exact commit/domain assignment.
- [ ] Verify actual browser interactions where accessible; record network/owner/iPhone limitations explicitly and run the required builder response gate.

## Execution ledger
Audit: canonical main/deployment 2470bf41, Vercel frontend prj_irrXhfz1elCLhO1Pdgd0ffM4wfz2. Production fetch via Vercel connector returns HTTP 200; direct browser and git hosts are denied by workspace egress. Source read through GitHub connector. npm offline install lacks zwitch; hosted CI is the available full-check path. No credentials/configuration modified.

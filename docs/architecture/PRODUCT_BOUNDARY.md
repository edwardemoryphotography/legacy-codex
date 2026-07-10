# Legacy Codex and Foundry Console — Canonical Product Boundary

**Status:** Canonical decision  
**Version:** 0.1  
**Effective date:** 2026-07-10  
**Owner:** Edward Emory  
**Supersedes:** Earlier descriptions that treated Legacy Codex as a documentation site, full technical platform, generic dashboard, or primarily neurofeedback product.

## Decision

Legacy Codex and Foundry Console are separate products with a shared data and service layer.

- **Legacy Codex** manages the relationship between the person and the work.
- **Foundry Console** manages the relationship between the software and the infrastructure.

They may share identity, project records, memory, integrations, agents, search, and event history. They must not share one undifferentiated primary interface.

## Legacy Codex

### Category

Personal cognitive operating system.

### Primary user

A high-capacity neurodivergent creator, operator, professional, or founder who has more vision than available executive bandwidth.

### Core promise

Legacy Codex turns scattered thoughts, unfinished work, changing energy, and lost context into calm, executable momentum.

### Primary question

> What matters right now, and what is the single best next move?

### Core loop

Capture → Clarify → Prioritize → Act → Remember → Resume

### Core responsibilities

- Capture thoughts before they disappear.
- Convert ambiguous ideas into concrete actions.
- Preserve decisions and context between sessions.
- Match work to available cognitive energy.
- Reduce the number of decisions required to begin.
- Surface one meaningful next action.
- Help the user resume without reconstructing the entire project.
- Detect recurring blockers, abandonment, overload, and false progress.

### Canonical surfaces

1. **Today** — energy, intention, blocker, active session, and one next action.
2. **Capture** — zero-friction intake for thoughts, voice, images, files, and observations.
3. **Projects** — purpose, desired outcome, current phase, milestone, blocker, and next action.
4. **Actions** — executable work only, prioritized by importance, urgency, energy, dependency, and project state.
5. **Memory** — resumption context, decisions, breakthroughs, patterns, constraints, and playbooks.
6. **Review** — stalled work, friction, constraints, real-versus-perceived progress, and continue/pause/archive decisions.

### Secondary modules

- **Cognition** — interpretation and visualization of cognitive load, attention, momentum, and stalled loops.
- **Semantic Starfield** — spatial memory and relationship visualization for retrieval, explanation, dependency discovery, and action creation.
- **Cognitive Profile** — durable personalization for communication, accessibility, energy patterns, overload signals, and effective interventions.

These modules support the core loop. They are not equal-weight permanent navigation tabs unless evidence proves that placement improves execution.

### Legacy Codex must not become

- A repository administration panel.
- A deployment dashboard.
- A replacement for GitHub, Vercel, Supabase, Notion, or a terminal.
- A catalogue of every artifact ever created.
- A visually impressive environment that does not alter the next action.
- A collection of disconnected AI experiments.

## Foundry Console

### Category

Technical builder and operations environment.

### Primary user

The builder, operator, technical collaborator, or agent responsible for creating and maintaining the systems that support Legacy Codex and the wider Artful Intelligence ecosystem.

### Core promise

Foundry Console makes the underlying technical system visible, controllable, testable, and deployable.

### Primary question

> What exists, what is running, what is broken, and what technical action must happen next?

### Core loop

Inspect → Diagnose → Build → Test → Deploy → Verify → Register

### Core responsibilities

- Register applications, repositories, services, modules, and deployment targets.
- Display branch, commit, build, deployment, environment, and verification state.
- Run or route agent tasks.
- Track tests, failures, dependencies, and technical blockers.
- Manage integrations and credentials safely.
- Publish approved modules into Legacy Codex.
- Prevent deployment sprawl and infrastructure duplication.
- Distinguish experiments, previews, production systems, and archived systems.

### Canonical surfaces

1. **Systems** — applications, repositories, services, modules, owners, and lifecycle state.
2. **Builds** — branches, commits, CI, previews, deployments, and verification.
3. **Agents** — available agents, tasks, providers, execution history, and approval state.
4. **Integrations** — GitHub, Vercel, Supabase, Convex, model providers, and other connected systems.
5. **Diagnostics** — failed builds, broken routes, missing configuration, data health, and sync failures.
6. **Modules** — approve, publish, version, rollback, and expose modules to Legacy Codex.
7. **PocketForge** — mobile creation and execution surface for building and iterating applications.

### Foundry Console must not become

- The user’s daily cognitive homepage.
- A general personal task manager or journal.
- A second version of the Legacy Codex Today screen.
- A simulation of technical activity without verified state changes.
- An autonomous production-changing system without review and rollback.

## Hard boundary

Legacy Codex operates at the level of:

- Intention
- Attention
- Energy
- Meaning
- Decisions
- Actions
- Memory
- Momentum

Foundry Console operates at the level of:

- Code
- Agents
- Repositories
- Builds
- Services
- Deployments
- Integrations
- Technical verification

A project may appear in both products, but it must appear through different representations.

### Legacy project representation

- Why it matters
- Desired outcome
- Current phase
- Energy requirement
- Emotional or cognitive friction
- Last meaningful progress
- Current blocker
- Next action
- Resume context

### Foundry project representation

- Repository
- Branch
- Framework and services
- Build status
- Test status
- Deployment target
- Environment status
- Open technical failures
- Last verified date

## Supporting-system placement

### Cognition

Legacy Codex visualization and interpretation module. It must reveal a pattern that supports a decision, retrieval, or action.

### Semantic Starfield

Legacy Codex spatial memory module. Every relationship shown must support retrieval, explanation, dependency discovery, source navigation, or action creation.

### Cognitive Profile

Shared personalization service primarily expressed through Legacy Codex. It may inform Foundry accessibility, but Foundry does not own the user’s cognitive identity.

### PocketForge

Foundry Console mobile builder module. Approved launch actions may be exposed inside Legacy Codex, but provider configuration, sandbox administration, source inspection, and deployment controls remain in Foundry.

### Case Study Zero

A workspace or implementation case inside Foundry Console. It is not the product definition of Foundry Console.

### Artful Intelligence

The commercial umbrella that may eventually contain Legacy Codex, Foundry Console, creator-specific agents, business automations, and educational products.

## Shared-service boundary

The products may share:

- Identity and permissions
- Project IDs and source links
- Memory and event records
- Search and semantic relationships
- Agent routing
- Integration registry
- Audit history
- Notifications

Shared services do not justify duplicating interfaces. Each product exposes only the information required for its primary job.

## Product decision test

Evaluate every proposed or existing feature with these questions:

1. Does it help the person decide, begin, continue, remember, or complete meaningful work? → **Legacy Codex**.
2. Does it help build, inspect, deploy, integrate, diagnose, or verify software? → **Foundry Console**.
3. Does it provide data to both products? → **Shared service**.
4. Is it primarily a visual or technical experiment without a proven job? → **Experiment**.
5. Does it lack a clear user, job, or measurable effect? → **Archive**.

## Acceptance gates

A successful Legacy Codex session ends with a meaningful human state change:

- A thought is safely captured.
- A project is clarified.
- A blocker is understood.
- Context is recovered.
- A meaningful next action is selected or completed.

A successful Foundry Console session ends with a verified technical state change:

- A build passed.
- A deployment was verified.
- A failure was diagnosed.
- An integration was restored.
- A module was published or rolled back.
- A system record was corrected.

## Governance

- Do not merge both products into one larger dashboard.
- Do not expose technical complexity inside Legacy Codex without a cognitive purpose.
- Do not place cognitive journaling, friction, or personal milestones in Foundry merely because the database already exists there.
- Do not restructure the frozen production application until the feature registry, schema inventory, and route map are reviewed.
- Inspect actual code, schemas, and deployments before trusting older architecture prose.
- Preserve historical documents, but label superseded definitions clearly.
- Real data only. No mock, synthetic, or simulated project state.

## Canonical one-sentence definitions

**Legacy Codex:** A personal cognitive operating system that helps neurodivergent creators capture thoughts, preserve context, match work to available energy, and consistently identify the single best next action.

**Foundry Console:** The technical operations environment used to build, connect, deploy, inspect, and maintain the agents, applications, integrations, and infrastructure that power Legacy Codex and the wider Artful Intelligence ecosystem.

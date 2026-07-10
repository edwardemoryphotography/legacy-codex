# Legacy Codex and Foundry Console — Feature Placement Registry

**Status:** Canonical placement guide  
**Version:** 0.1  
**Effective date:** 2026-07-10  
**Source decision:** [`PRODUCT_BOUNDARY.md`](./PRODUCT_BOUNDARY.md)

## Classification labels

- **Legacy** — cognitive command layer.
- **Foundry** — technical build and operations layer.
- **Shared** — data or service consumed by both products.
- **Experiment** — useful prototype without a proven permanent product job.
- **Archive** — superseded or unsupported work retained for history.

## Current-to-target placement

| Current feature or artifact | Current location | Decision | Canonical target | Rationale |
|---|---|---|---|---|
| Overview | Root Legacy Codex | Rename | Legacy → Today | Must answer what matters now rather than summarize the whole system. |
| Protocols | Root Legacy Codex | Keep and demote | Legacy → Memory / Playbooks | Valuable cognitive scaffolding, but not a permanent primary tab. |
| Sprint Linker | Root Legacy Codex | Split | Legacy Projects + Shared sprint record + Foundry execution view | Human momentum and technical execution require different representations. |
| Resumption Log | Root Legacy Codex | Keep | Legacy → Memory / Resume | Directly solves lost context between sessions. |
| Biometrics | Root Legacy Codex | Reframe | Legacy → Energy / Cognitive Profile | Use physiology and self-report to guide work selection, not as a medical dashboard. |
| Constraint Validator | Root Legacy Codex | Keep | Legacy → Review / Decision Support | Supports reality filtering, overload prevention, and project triage. |
| Codex knowledge tree | Root Legacy Codex | Split | Legacy Memory + Shared reference service | Identity, mission, values, neuro, artistic systems, and context are cognitive knowledge. |
| Capture inbox | Root Controls tab | Move | Legacy → Capture | Capture is a core product surface and must not be hidden under technical controls. |
| Density, font scale, contrast, reduced motion | Root Controls tab | Move | Legacy → Cognitive Profile / Accessibility | Personal adaptation belongs to the cognitive experience. |
| Manual work modes | Root Controls tab | Move | Legacy → Today / Energy | Deep Build, Creative Edit, Admin Light, and Recovery are cognitive modes. |
| Biometric mode recommendation | Root Controls tab | Move | Legacy → Today / Energy | It should affect next-action selection, not exist as a control-panel diagnostic. |
| Supabase authentication | Root Controls tab | Split | Simple status in Legacy; configuration and diagnostics in Foundry | Legacy needs confidence that data is safe; Foundry owns technical troubleshooting. |
| Cloud synchronization controls | Root Controls tab | Split | Automatic behavior in Shared service; diagnostics in Foundry | Technical sync state must not dominate the cognitive interface. |
| Workspace selector | Foundry Console | Keep | Foundry → Systems | Appropriate for a builder or operator managing multiple environments. |
| Sprints list and editing | Foundry Console | Split | Legacy Projects + Shared sprint record + Foundry Builds | Goal state and technical execution state are different jobs. |
| Friction log | Foundry Console | Move | Legacy → Review / Memory | Friction is behavioral and cognitive context. |
| Milestones timeline | Foundry Console | Move | Legacy → Projects | Milestones help the person understand progress and direction. |
| Manual pages | Foundry Console | Split | Shared knowledge service | User-facing playbooks appear in Legacy; technical runbooks appear in Foundry. |
| Settings and role administration | Foundry Console | Keep | Foundry → Settings / Permissions | Technical administration belongs in Foundry. |
| Audit log | Foundry Console | Keep | Foundry → Audit / Diagnostics | Operational traceability is a core Foundry responsibility. |
| JSON export | Foundry Console | Keep | Foundry → Data Management | Data portability and system export are technical controls. |
| Case Study Zero | Foundry Console identity | Reclassify | Foundry workspace | It is an implementation case, not the product definition. |
| PocketForge | Repository sub-application | Keep | Foundry → Mobile Builder | It builds, runs, inspects, and iterates applications through Convex, providers, and sandboxes. |
| Cognition | Undeployed visual artifact | Keep as module | Legacy → Cognition | Retain only when the visualization changes a decision, retrieval, or action. |
| Semantic Starfield | Experimental artifact | Keep as module | Legacy → Spatial Memory | Every connection shown must support retrieval, explanation, dependency discovery, or action creation. |
| Cognitive Profile | Distributed concept and preferences | Consolidate | Shared service, primarily expressed in Legacy | Personalization should adapt communication, energy, accessibility, and recommendations. |
| Technical deployment status | Distributed across files and services | Consolidate | Foundry → Builds / Systems | Branch, CI, environment, deployment, and verification belong together. |
| Agent execution and provider routing | PocketForge and infrastructure code | Consolidate | Foundry → Agents | Legacy may request work but should not expose provider and execution internals. |
| Product and project memory | STATE.md, Notion, app data | Shared with clear authority | Shared memory service + canonical records | Durable decisions must have an explicit source of truth and history. |

## Target Legacy Codex navigation

1. **Today**
2. **Capture**
3. **Projects**
4. **Actions**
5. **Memory**
6. **Review**

Secondary modules:

- Cognition
- Semantic Starfield
- Cognitive Profile

## Target Foundry Console navigation

1. **Systems**
2. **Builds**
3. **Agents**
4. **Integrations**
5. **Diagnostics**
6. **Modules**
7. **PocketForge**

## Shared project contract

A project has one stable identity with two representations.

### Cognitive fields

- `purpose`
- `desired_outcome`
- `current_phase`
- `energy_requirement`
- `friction`
- `last_meaningful_progress`
- `current_blocker`
- `next_action`
- `resume_context`
- `review_date`

### Technical fields

- `repository`
- `branch`
- `framework`
- `services`
- `build_status`
- `test_status`
- `deployment_target`
- `environment_status`
- `technical_failures`
- `last_verified_at`

This registry does not authorize a schema migration. Existing Supabase and Convex schemas must be inventoried before field names or ownership are implemented.

## Migration order

1. Create and approve this registry.
2. Inventory current Supabase and Convex schemas.
3. Map existing routes and tabs to the target navigation.
4. Separate cognitive state from technical state without deleting functionality.
5. Extract mixed Controls functionality.
6. Reframe current Foundry routes.
7. Integrate PocketForge as a Foundry module.
8. Run separate Legacy and Foundry acceptance tests.

## Change-control rule

Any new screen, route, database table, service, or agent must declare one owner in its pull request:

- `owner: legacy`
- `owner: foundry`
- `owner: shared`
- `owner: experiment`
- `owner: archive`

A feature cannot be approved if its owner and primary job are ambiguous.

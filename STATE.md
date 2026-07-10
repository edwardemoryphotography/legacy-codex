# STATE.md — Edward Emory Photography / Artful Intelligence

_Last updated: 2026-07-10_

---

## 🧭 CANONICAL PRODUCT ARCHITECTURE

**Decision status:** Canonical as of July 10, 2026.

- **Legacy Codex** = personal cognitive operating system.
  - Primary question: **What matters right now, and what is the single best next move?**
  - Owns intention, attention, energy, decisions, actions, memory, momentum, resumption, friction, and human project state.
- **Foundry Console** = technical builder and operations environment.
  - Primary question: **What exists, what is running, what is broken, and what technical action must happen next?**
  - Owns repositories, builds, deployments, integrations, agents, diagnostics, technical verification, and module publishing.
- **Hard boundary:** Legacy manages the relationship between the person and the work. Foundry manages the relationship between the software and the infrastructure.
- **Shared services:** identity, permissions, project IDs, source links, memory, search, event history, agent routing, and integration registry.
- **PocketForge:** Foundry mobile builder module with selected launch actions exposed to Legacy.
- **Cognition:** Legacy visualization and interpretation module.
- **Semantic Starfield:** Legacy spatial memory and relationship module.
- **Cognitive Profile:** shared personalization service primarily expressed through Legacy.
- **Case Study Zero:** a workspace inside Foundry, not the definition of Foundry.
- **Artful Intelligence:** the commercial umbrella for both products and related creator systems.

Canonical files:

- `docs/architecture/PRODUCT_BOUNDARY.md`
- `docs/architecture/FEATURE_PLACEMENT.md`
- `docs/superpowers/plans/2026-07-10-legacy-codex-foundry-boundary.md`

Any older document that conflicts with these files is historical context, not current architecture.

---

## ✅ SHIPPED

- **Photographer Agent Pack V1** → live on Gumroad (`edwardemory.gumroad.com/l/photographer-agent-pack-v1`)
- **Artful Intelligence storefront** (`artful-intelligence-v1.html`) → deployed to Vercel, June 9 2026
- **Starforge** → working prompt → Claude API → live HTML preview loop
- **MacBook file system** → dead Downloads symlink replaced; automated file organizer scripts verified
- **Legacy Codex** → live at `legacy-codex.vercel.app`
- **Legacy Codex / Foundry Console product boundary** → defined, audited, and recorded in docs/architecture/PRODUCT_BOUNDARY.md

---

## 🔴 BLOCKED / STALLED

- **Canonical architecture implementation** → UI and schema changes are intentionally blocked until the current schema inventory and route map are completed and reviewed
- **Muse 2 EEG system** → Docker errors blocking; WHOOP integration unstarted (energy-gated stall)
- **Netlify MCP** → OAuth broken as of June 9; do not use until re-authenticated and a read-only call confirms it works
- **Cognition documentary deck** (`cognition-final.html`) → built May 19, not deployed
- **Codex Operations panel** (`codex-operations.html`) → built May 19, not deployed
- **Codex Territory Dashboard** (`codex-territory-v36.html`) → built May 19, not deployed

---

## 🚧 NEXT (priority order)

1. Review and merge the canonical product-boundary documentation branch
2. Execute the Superpowers Phase 3 plan: current schema inventory + current-to-target route map
3. Add machine-readable product ownership and tests without rewriting the frozen UI
4. Split mixed Controls responsibilities only after the inventory is approved
5. Reframe Foundry routes so cognitive friction/milestones move to Legacy while audit/admin/diagnostics remain in Foundry
6. First real buyer / user-test of Agent Pack V1 → gate before unrelated new product expansion
7. Deploy the May 19 trio as bounded modules or historical artifacts, not as competing product definitions
8. Namibia workshop relaunch planning (2027–2028) with Richard Morsback
9. Reach out to Nick (National Geographic contact) for career path conversation
10. Starforge → SwiftUI WKWebView wrapper for iPhone demo

---

## 🔒 FROZEN — DO NOT TOUCH

- **Legacy Codex `app/index.html`** → FREEZE SPEC active; no rewrite unless Eddie explicitly says "REWRITE THE APP CODE"
- **Current Legacy Codex production navigation and data model** → no structural rewrite until feature registry, schema inventory, and route map are approved
- **Artful Intelligence brand launch** → on hold pending Eddie's decision on @Freddy_v association
- **AI-powered CMS architecture** (Claude Code + Firecrawl + MongoDB) → parked; 5 scoping questions pending; no buyer yet

---

## ⚙️ ACTIVE GOVERNANCE RULES

- Legacy Codex and Foundry Console must remain separate primary interfaces
- Every new feature must declare one owner: `legacy`, `foundry`, `shared`, `experiment`, or `archive`
- Do not expose technical complexity in Legacy Codex unless it changes a cognitive decision or next action
- Do not place cognitive journaling, friction, personal milestones, or resumption state in Foundry merely because the database already exists there
- No UI or schema migration until the current readers, writers, routes, and dependencies are documented
- Historical architecture documents must be preserved but labeled superseded when they conflict with the canonical boundary
- No new frameworks until a current artifact is user-tested by a real buyer
- Shipped proof beats doctrine
- Monetization requires: named buyer + price band + first deliverable ≤14 days + sales channel + why they'd pay now
- Deployment friction is the primary recurring bottleneck — one-step flows only
- Real data only — zero mock/synthetic/simulated content, ever
- Plans >~40 lines → self-contained HTML artifact, not a doc; Superpowers implementation plans may remain Markdown in `docs/superpowers/plans/`

---

## 🛠️ STACK & KEYS REFERENCE

| Thing | Value |
|---|---|
| GitHub | EdwardEmoryPhotography |
| Vercel teamId | `team_vp0GcqRDdFkQQ3NRZU9NJ11O` |
| Artful Intelligence project | `prj_NxOtPIdA833whnS4TvybcfWJNLqK` |
| Artful Intelligence config | Static "Other" — files must be at repo root |
| Proven deploy path | GitHub Contents API via curl (fetch SHA → PUT with base64) |
| Gumroad | `edwardemory.gumroad.com` |
| Email | `pro@edwardemory.com` |
| Instagram | `@freddy_v` |

---

## 📝 UPDATE PROTOCOL

Before starting any session: read this file and the canonical architecture files.  
After any session that ships, blocks, or unblocks something: update this file.  
Three lines minimum: what shipped / what's blocked / what's next.  
Architecture changes require an explicit decision record and updated feature ownership.

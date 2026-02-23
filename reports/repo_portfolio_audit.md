# Portfolio Audit and Consolidation Plan

- **Owner**: `edwardemoryphotography`
- **Generated**: 2026-02-23 12:47:12 UTC
- **Active repos scanned**: 12 (5 core + 7 forks)
- **Core repos missing at least one key governance doc**: 5/5

## 1) Active Repository Inventory

| Repo | Type | Primary Lang | Theme | Updated |
| --- | --- | --- | --- | --- |
| codex-system-architecture | Core | TypeScript | Codex + System Architecture | 2026-02-21 |
| legacy-codex | Core | HTML | Codex + System Architecture | 2026-02-23 |
| muse-neurofeedback | Core | HTML | EEG + Neurofeedback | 2026-02-22 |
| MuseEEGProject | Core | Dockerfile | EEG + Neurofeedback | 2026-02-21 |
| neurocreative-platform | Core | Python | EEG + Neurofeedback | 2026-02-21 |
| brew | Fork | Ruby | Agent Tooling + Interface Layer | 2026-02-21 |
| gemini-cli | Fork | TypeScript | Agent Tooling + Interface Layer | 2026-02-21 |
| mem-layer | Fork | Python | Memory + Knowledge Systems | 2026-01-20 |
| opencode | Fork | TypeScript | Agent Tooling + Interface Layer | 2026-02-21 |
| retain | Fork | Swift | Memory + Knowledge Systems | 2026-02-21 |
| snag | Fork | Python | Agent Tooling + Interface Layer | 2026-02-21 |
| vibetunnel | Fork | TypeScript | Agent Tooling + Interface Layer | 2026-02-21 |

## 2) Key File and Governance Coverage (Core Repos)

| Repo | README | LICENSE | CHANGELOG | CONTRIBUTING | SECURITY | WORKFLOWS | Missing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| codex-system-architecture | Yes | Yes | No | No | No | No | CHANGELOG, CONTRIBUTING, SECURITY, WORKFLOWS |
| legacy-codex | Yes | Yes | Yes | No | No | No | CONTRIBUTING, SECURITY, WORKFLOWS |
| muse-neurofeedback | Yes | Yes | No | No | No | No | CHANGELOG, CONTRIBUTING, SECURITY, WORKFLOWS |
| MuseEEGProject | Yes | Yes | No | No | No | Yes | CHANGELOG, CONTRIBUTING, SECURITY |
| neurocreative-platform | Yes | Yes | No | No | No | No | CHANGELOG, CONTRIBUTING, SECURITY, WORKFLOWS |

## 3) Redundancy and Overlap Clusters

### Codex + System Architecture
Potential overlap detected across **2 repos**: `codex-system-architecture`, `legacy-codex`.

Best currently-shipped features to preserve:

- **codex-system-architecture**
  - Define system components and their relationships
  - Map data flows between AI agents, memory, and UI
  - Prototype architecture changes before implementation
  - Maintain a living technical spec for the platform
- **legacy-codex**
  - **7-Phase Collaboration Protocol** — a step-by-step method for working with AI or collaborators, from initial assumption to meta-recognition.
  - **Legacy Codex architecture** — a structure for preserving keystone principles, narratives, artifacts, and long-term continuity plans.
  - **Transmission framework** — the four vehicles through which this work spreads (Narratives, People, Artifacts, Structures).
  - **Continuity blueprint** — immediate and long-term actions to turn insight into repeatable practice.

### EEG + Neurofeedback
Potential overlap detected across **3 repos**: `muse-neurofeedback`, `MuseEEGProject`, `neurocreative-platform`.

Best currently-shipped features to preserve:

- **muse-neurofeedback**
  - Real-time EEG data streaming via Python WebSocket
  - Muse 2 headband compatibility (Mind Monitor bridge)
  - Live brainwave band visualization (alpha, beta, theta, delta, gamma)
  - Mindfulness session tracking and scoring
- **MuseEEGProject**
  - Real-time EEG data ingestion from Muse 2 headband
  - Brainwave band analysis (alpha, beta, theta, delta, gamma)
  - Docker-containerized deployment for portability
  - Automated CI/CD via GitHub Actions workflows
- **neurocreative-platform**
  - Real-time EEG data streaming via Python WebSocket
  - Muse 2 headband integration via Mind Monitor (OSC)
  - Live brainwave band display (alpha, beta, theta, delta, gamma)
  - WHOOP 4.0 HRV + recovery data overlay (planned)

## 4) Consolidation Targets (Robust Repo Set)

| Target Repo | Source Repos to Merge | Best Features to Preserve |
| --- | --- | --- |
| `codex-core` | legacy-codex + codex-system-architecture | - Canonical protocol dashboard + execution governance<br>- Interactive architecture diagrams and dependency map<br>- Codex release/changelog discipline with visibility tooling |
| `neurofeedback-stack` | muse-neurofeedback + neurocreative-platform + MuseEEGProject | - Real-time Muse EEG ingestion and visualization<br>- Containerized runtime + CI/test harness from MuseEEGProject<br>- WHOOP correlation and adaptive neurodivergent state modeling |
| `memory-intelligence` | mem-layer + retain | - Persistent memory scopes and temporal knowledge tracking<br>- Conversation sync + searchable personal knowledge base<br>- Model-to-model note passing and learning extraction workflows |
| `agent-tooling-hub` | gemini-cli + opencode + vibetunnel + snag | - CLI and browser/terminal agent interfaces<br>- Capture and artifact-ingestion pipeline for prompts<br>- Unified docs for upstream fork purpose + custom delta tracking |

## 5) Action Sequence

1. Create or designate the 4 target repos listed above.
2. Move feature-complete code first (do not start with docs-only migration).
3. Add missing governance docs in every core repo: `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, CI workflows.
4. Mark old overlapping repos as `legacy-*` or archive after migration checkpoints.
5. Keep this audit script in CI (weekly) to prevent new fragmentation.

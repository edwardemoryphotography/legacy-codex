# Unified Repo Blueprint (Sentiment-Preserving Consolidation)

## Why this exists

Your repo ecosystem shows a clear pattern: each newer repo explored a stronger idea, but execution split across multiple places before consolidation. This blueprint keeps the original intent ("sentiment") and gives each theme a robust home.

## Core sentiment threads to preserve

1. **Neurodivergent execution governance**  
   Systems should reduce friction and preserve momentum through clear protocols, continuity, and artifact-first work.
2. **Measured cognitive state feedback**  
   Muse EEG (and eventually WHOOP) should turn focus/recovery state into actionable feedback loops.
3. **Persistent memory and continuity**  
   Learnings, context, and cross-session decisions should compound instead of resetting.
4. **Agent-native tooling surface**  
   Fast interfaces (CLI, browser/terminal bridge, capture tools) should make execution immediate.

## Target robust repo set

### 1) `codex-core`
Primary role: governance + architecture source of truth.

**Merge from**
- `legacy-codex`
- `codex-system-architecture`

**Keep**
- 7-phase protocol and constraint validator UX
- resumption logging and artifact anchoring controls
- living architecture diagrams and integration maps

**Recommended structure**
```text
codex-core/
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── docs/
│   ├── architecture/
│   ├── protocols/
│   └── decisions/
├── apps/
│   ├── dashboard/          # current operational UI
│   └── architecture-view/  # architecture explorer
└── .github/workflows/
    ├── ci.yml
    └── docs-check.yml
```

### 2) `neurofeedback-stack`
Primary role: real-time EEG + biometrics productization.

**Merge from**
- `muse-neurofeedback`
- `neurocreative-platform`
- `MuseEEGProject`

**Keep**
- Muse ingestion + WebSocket streaming
- band analysis and live visualization
- containerized runtime + CI/test pattern
- WHOOP correlation as next milestone

**Recommended structure**
```text
neurofeedback-stack/
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── backend/
│   ├── ingest/
│   ├── signal/
│   └── api/
├── frontend/
│   ├── dashboard/
│   └── session-viewer/
├── infra/
│   ├── docker/
│   └── workflows/
├── tests/
└── .github/workflows/
    ├── ci.yml
    └── integration.yml
```

### 3) `memory-intelligence`
Primary role: durable context and learning system.

**Merge from**
- `mem-layer`
- `retain`

**Keep**
- scoped memory model (user/project/code)
- temporal knowledge tracking
- conversation sync/search + learning extraction
- model-to-model notes and MCP support

**Recommended structure**
```text
memory-intelligence/
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── docs/
│   ├── memory-model/
│   ├── retention-policies/
│   └── mcp/
├── services/
│   ├── ingestion/
│   ├── indexing/
│   └── retrieval/
├── clients/
│   ├── cli/
│   └── desktop/
└── .github/workflows/
    ├── ci.yml
    └── release.yml
```

### 4) `agent-tooling-hub`
Primary role: execution interfaces + artifact capture.

**Merge from**
- `gemini-cli`
- `opencode`
- `vibetunnel`
- `snag`

**Keep**
- terminal-native AI workflows
- browser-terminal bridge UX
- screenshot/artifact-to-text ingestion
- upstream fork deltas documented as product decisions

**Recommended structure**
```text
agent-tooling-hub/
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── docs/
│   ├── fork-deltas/
│   ├── interface-contracts/
│   └── command-recipes/
├── cli/
├── capture/
├── bridge/
└── .github/workflows/
    ├── ci.yml
    └── release.yml
```

## Migration sequence (do this in order)

1. Consolidate **neurofeedback-stack** first (highest overlap and duplicated effort).
2. Consolidate **codex-core** second (governance + architecture alignment).
3. Consolidate **memory-intelligence** third (context durability backbone).
4. Consolidate **agent-tooling-hub** fourth (interface acceleration layer).

## Definition of done for each target repo

- README has clear scope, quickstart, and roadmap
- CHANGELOG exists and gets updated every release
- CONTRIBUTING + SECURITY docs exist
- CI workflow validates build/tests/docs on PR
- legacy overlap repos are archived or relabeled `legacy-*` after migration freeze


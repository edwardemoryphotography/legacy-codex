# GEMINI.md — Legacy Codex v37 Instructional Context

This file provides foundational context and mandates for Gemini CLI interactions within the `legacy-codex` workspace.

## Project Overview

**Legacy Codex v37** is a personal operating system designed to transform captures (voice notes, thoughts, brain dumps) into clear, executable next steps. This specific workspace acts as the **local body** of the system—a grounding layer intended to reduce cognitive overhead and prevent fragmentation between local files, GitHub repository state, and the production environment.

- **Primary Goal:** Always end in a tiny, executable next step.
- **Core Philosophy:** Reduce fragmentation, name blockers, and maintain a single source of truth.
- **Production Anchor:** [https://legacy-codex.vercel.app](https://legacy-codex.vercel.app) (Production truth wins).

## Key Files & Structure

- `AGENTS.md`: Defines core roles (Scout, Architect, Finisher), specialized agent workflows (Bottleneck Analyst, Delegation Router, Session Scribe, REK Scope Guard), and the canonical **V37 anchors (do not drift)** table (Vercel URL, FREEZE SPEC, `SHIPPING_BLOCKER.txt`, delegation rules).
- `DELEGATION_RULES_v1.md`: Contains the routing logic for classifying captures and assigning them to project lanes (e.g., Codex, Metal Prints, Artful Intelligence).
- `SHIPPING_BLOCKER.txt`: A single-sentence file tracking the current primary blocker to project progress.
- `notes/`: Session logs, decisions, resumption points (e.g., `SESSION_2026-03-23-v37-unjam.md`). Templates: `TEMPLATE_SESSION_RESUME.md`, `DAILY_STARTUP_v37.md`.
- `README.md`: Front door index linking AGENTS, blocker, delegation, and note templates.
- `agents/`: Directory reserved for future agent-specific prompt files or templates.
- `logs/`: Directory for execution traces, audits, and deployment notes.

## Operational Mandates & Conventions

### 1. The FREEZE SPEC
Do **not** rewrite `index.html`, core JavaScript, or core CSS in the associated app code unless explicitly commanded with the phrase: `REWRITE THE APP CODE`. Prefer the smallest safe patch.

### 2. Execution Workflow
Every task should follow the **Situation -> Tiny Step -> Deliverable -> Verification -> Next Step** pattern.
- **Tiny Step:** An action completable in under 3 minutes.
- **Grounding:** If a decision is not documented in a file (notes, blockers, or rules), it doesn't exist.

### 3. Routing Logic
When handling raw captures (often prefixed with `[VOICE-SYNC]`), refer to `DELEGATION_RULES_v1.md` to determine the correct project lane and destination.

### 4. Shipping Blocker
Always respect and, if necessary, update `SHIPPING_BLOCKER.txt`. It must contain exactly **one** concrete sentence describing what is currently stalling progress.

## Usage Guidelines

- **Resumption:** When starting a new session, read `SHIPPING_BLOCKER.txt`, `DELEGATION_RULES_v1.md`, and the most recent note in `notes/` to establish current state.
- **Scouting:** Always gather context and verify the "production truth" at the Vercel URL before proposing architectural changes.
- **Scope Guarding:** Prevent "strategy spirals" by forcing a physical action and visible deliverable for every response.

## Development Status (v37 Unjam)
The system is currently in a "stabilization" phase focused on reducing the "80% completion stall" and anchoring the local body as the primary management interface for the broader Legacy Codex ecosystem.

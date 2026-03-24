# DELEGATION_RULES_v1

Purpose: turn raw captures into the correct project lane without opening five tools or overthinking routing.

This file is intentionally simple. It is a first-pass routing layer for Legacy Codex v37.

---

## Core Rule

Every capture gets routed to **one primary destination first**.

Do not multi-home a capture unless it has already been clarified.

If a capture feels like it belongs everywhere, route it to the place where the **next physical action** is most likely to happen.

---

## Input Format

Expected capture format from voice or quick entry:

```text
[VOICE-SYNC] <raw thought>
```

The router should ask:
1. What is this actually about?
2. Which project owns the next real action?
3. What is the smallest next move?

---

## Project Routes

### Route A — Legacy Codex v37
Use when the capture mentions or implies:
- Codex
- CSF / LAR / REK
- routing
- capture system
- agents
- dashboard
- execution engine
- memory structure
- local workspace
- Vercel / deployment truth for Codex

**Default destination:**
- local note in `notes/`
- Codex actions queue
- `AGENTS.md`, `SHIPPING_BLOCKER.txt`, or a Codex-specific spec file

**Examples:**
- “I need a better way to route all these voice notes.”
- “The REK guard should stop me from bloating scope.”
- “I need to know which version of Codex is real.”

---

### Route B — 6-Figure Metal Prints
Use when the capture mentions or implies:
- prints
- metal prints
- limited edition drops
- collectors
- pricing
- print offer
- fulfillment
- sales page
- drop calendar
- revenue from artwork

**Default destination:**
- revenue note
- offer doc
- pricing/action list

**Examples:**
- “I need to finalize print pricing tiers.”
- “This image might be part of the next print drop.”
- “How do I make the print offer feel premium?”

---

### Route C — Artful Intelligence
Use when the capture mentions or implies:
- automation for creatives
- AI workflows
- client systems
- editing automation
- creative business tools
- agent packs
- software for photographers
- automation product ideas

**Default destination:**
- product note
- feature backlog
- workflow spec

**Examples:**
- “There should be a Lightroom handoff agent.”
- “I want a client inquiry-to-booking workflow.”
- “This should become a product for photographers.”

---

### Route D — Muse2 / Neurofeedback
Use when the capture mentions or implies:
- Muse
- EEG
- WHOOP
- neurofeedback
- brain state
- focus tracking
- stress detection
- signal processing
- biometrics

**Default destination:**
- research note
- experiment log
- technical next-step note

**Examples:**
- “I want to compare EEG state to creative flow.”
- “WHOOP should sync with the Muse pipeline.”
- “The graph is not updating with real EEG data.”

---

### Route E — Holding / Clarify
Use when:
- the capture is emotionally real but operationally unclear
- it mixes multiple projects and no next action is obvious
- it is reflection, not execution
- it needs one sentence of clarification before routing

**Default destination:**
- `notes/` as a short clarify note
- later conversion into one primary route

**Examples:**
- “Everything matters and I don’t know where to start.”
- “This feels important but I can’t tell if it’s product, philosophy, or marketing.”

---

## Fast If/Then Router

Use this quick pass before deeper thinking:

- If it mentions **Codex, LAR, CSF, REK, routing, capture, deployment truth** → **Legacy Codex v37**
- If it mentions **Print, edition, collectors, pricing, drop, artwork sales** → **6-Figure Metal Prints**
- If it mentions **Automation, workflows, agents for creatives, AI tools, photographer product** → **Artful Intelligence**
- If it mentions **Muse, EEG, WHOOP, neurofeedback, focus, biometrics** → **Muse2 / Neurofeedback**
- If it is **too mixed or emotionally overloaded** → **Holding / Clarify**

---

## Clarify Template

If a capture cannot be routed immediately, rewrite it in this form:

```text
This is mainly about: <one project>
The next real action is: <one action>
This should live in: <one file or queue>
```

If that cannot be answered in under 60 seconds, place it in **Holding / Clarify** and move on.

---

## Output Format

When routing a capture, respond like this:

### Route
`<chosen route>`

### Why
`<one-sentence reason>`

### Next Action
`<one visible physical action>`

### Destination
`<file, queue, or note location>`

Example:

### Route
Legacy Codex v37

### Why
This capture is about routing behavior inside the Codex system itself.

### Next Action
Add one line to `DELEGATION_RULES_v1.md` clarifying where mixed captures go.

### Destination
`~/legacy-codex/DELEGATION_RULES_v1.md`

---

## Guardrails

- Do not create a new project lane unless repeated evidence demands it.
- Do not turn every reflection into a task.
- Do not split one capture into five destinations.
- Do not let routing become a procrastination ritual.
- The goal is motion, not categorization perfection.

---

## v1 Limitation

This is a manual routing layer.

It is not yet:
- synced to Firebase
- automated through Make.com
- embedded in the live app UI
- connected to Git or repo docs

That is intentional.

v1 exists to prove that a simple routing rule set reduces cognitive overhead before automation is introduced.

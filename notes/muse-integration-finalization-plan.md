# Muse integration — finalization checklist

**Purpose:** Close the gap between the **mock** biometric layer in this repo and a **dependable Muse (EEG) → focus signal → task ranking** path, aligned with **Route D — Muse2 / Neurofeedback** in `DELEGATION_RULES_v1.md`.

**Current repo reality (as of this note):**

- `src/lib/biometrics.ts`: **`BIOMETRICS_SOURCE=mock`** (default) uses fixed demo scores; **`BIOMETRICS_SOURCE=file`** reads **`notes/biometric-state.json`** (see `notes/biometric-state.example.json`) so a **local Muse/Whoop bridge** can overwrite that file in real time. `notes/biometric-state.json` is gitignored.
- `src/agents/taskRanker.ts` (`npm run rank`) already consumes `getCurrentBiometrics()` and feeds **Muse focus** into the Gemini prompt—wire your bridge to the JSON file, then run rank.

---

## 1. Signal path & hardware

- [ ] Choose the **canonical Muse pipeline** (e.g. Muse Direct OSC, Lab Streaming Layer, vendor SDK, or a small local bridge you already trust).
- [ ] Document **device + OS requirements** (headset model, Bluetooth vs dongle, background permissions).
- [ ] Define **when** biometrics are sampled (continuous vs on-demand before `npm run rank`, vs daemon writing a small state file).
- [ ] Add a **“no headset / stale data”** fallback (clear log message + safe defaults or skip ranking).

## 2. Implement `getCurrentBiometrics()` for real Muse data

- [x] **File bridge (done):** `BIOMETRICS_SOURCE=file` reads **`notes/biometric-state.json`** (see `biometric-state.example.json`); mock remains the default.
- [ ] Drive that JSON from **real Muse/Whoop** (OSC, API, or daemon)—replace or extend the file reader when you have a live stream.
- [ ] Map raw Muse metrics → the existing **`focusScore` 0–100** contract (or extend `BiometricState` and update `taskRanker.ts` + prompts in one pass).
- [ ] Handle **disconnects, timeouts, and partial packets** without crashing the CLI.
- [ ] Keep a **fixture mode** (env flag e.g. `BIOMETRICS_FIXTURE=1`) for CI or laptop-only runs.

## 3. Whoop / recovery (optional but referenced in code)

- [ ] Decide: **ship Muse-only first** or **pair Whoop recovery** as in the current prompt copy.
- [ ] If Whoop: API keys, token refresh, and rate limits; map to **`recoveryScore`**.
- [ ] If deferred: adjust comments in `biometrics.ts` and the **Task Ranker** prompt so “Whoop” is not implied as live.

## 4. Pipeline & operations

- [ ] Confirm **`npm run rank`** runs end-to-end with real data and an existing `notes/TRIAGE_QUEUE.md` (or document the prerequisite).
- [ ] Add a **one-screen “how to run”** blurb (this file or `README.md`): start Muse bridge → run rank → inspect updated queue.
- [ ] Log **timestamp + source** when writing or ranking (aids debugging “why did my queue reorder?”).

## 5. Privacy, security, and scope

- [ ] Confirm **no raw EEG or tokens** are written to `notes/` or committed files by default.
- [ ] Keep secrets in **`.env`** only; document any new variables in **`.env.example`** (no real values).
- [ ] Respect **FREEZE SPEC** for the Vercel app: Muse work stays in **local scripts/libs** unless you explicitly escalate with `REWRITE THE APP CODE`.

## 6. Delegation & artifacts

- [ ] When captures mention Muse/EEG/biometrics, route per **Route D** (`DELEGATION_RULES_v1.md`)—link experiment logs or ADRs from here if useful.
- [ ] After integration is stable, add a **short “Muse operational note”** (metrics definition, runbook, known issues) under `notes/` or `logs/`.

## 7. Definition of done

- [ ] With headset (or approved simulator), **`getCurrentBiometrics()`** returns values that **change** with state, not fixed `72/88`.
- [ ] **`npm run rank`** uses those values and produces a sensible reorder + rationale in `notes/TRIAGE_QUEUE.md`.
- [ ] **Fixture mode** still works on machines without hardware.
- [ ] You can explain the stack in **one paragraph** to your future self (append below).

---

## One-paragraph stack summary (fill when done)

*(Date / name — how Muse → focus score → rank works in your setup.)*

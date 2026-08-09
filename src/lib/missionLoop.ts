// Pure Mission Loop lifecycle logic — spec: docs/architecture (Superpowers Mission Loop, §5–§9).
// No I/O here. Supabase persistence and the mission_events append-only log
// are wired in a later phase; this module is the state machine those calls
// will drive, kept testable in isolation.

import type { Mission, MissionEvent, MissionEventType, MissionState, CapacityLevel } from '@/types'

export interface MissionBoard {
  missions: Record<string, Mission>
}

export const EMPTY_BOARD: MissionBoard = { missions: {} }

export interface ActionResult {
  board: MissionBoard
  event: MissionEvent | null
  error: string | null
}

function fail(board: MissionBoard, error: string): ActionResult {
  return { board, event: null, error }
}

function makeEvent(missionId: string, type: MissionEventType, detail: string, now: string): MissionEvent {
  return {
    id: `${missionId}-${type}-${now}`,
    missionId,
    type,
    detail,
    createdAt: now,
  }
}

function putMission(board: MissionBoard, mission: Mission): MissionBoard {
  return { missions: { ...board.missions, [mission.id]: mission } }
}

export function findByState(board: MissionBoard, state: MissionState): Mission | null {
  return Object.values(board.missions).find(m => m.state === state) ?? null
}

// ─── Capture ────────────────────────────────────────────────────────────
// A new idea always enters Parked by default (spec §6). Promoting a
// Parked mission to Candidate/Primary/Secondary is a separate, explicit step.
export function captureIdea(
  board: MissionBoard,
  args: { id: string; title: string; why?: string; now: string },
): ActionResult {
  const title = args.title.trim()
  if (!title) return fail(board, 'Mission title cannot be empty.')

  const mission: Mission = {
    id: args.id,
    title,
    why: args.why?.trim() ?? '',
    finishLine: null,
    evidenceRequirement: null,
    state: 'parked',
    blocker: null,
    capacityMismatch: false,
    createdAt: args.now,
    updatedAt: args.now,
  }

  return {
    board: putMission(board, mission),
    event: makeEvent(mission.id, 'captured', title, args.now),
    error: null,
  }
}

// ─── Finish line ────────────────────────────────────────────────────────
// Required before a mission can become Primary or Secondary (spec §5).
export function setFinishLine(
  board: MissionBoard,
  missionId: string,
  finishLine: string,
  now: string,
): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)

  const trimmed = finishLine.trim()
  if (!trimmed) return fail(board, 'Finish line cannot be empty.')

  const next: Mission = { ...mission, finishLine: trimmed, updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'finish_line_set', trimmed, now),
    error: null,
  }
}

// ─── Promotion ──────────────────────────────────────────────────────────
// Cannot silently replace an occupied Primary/Secondary slot — that path is
// requestPriorityChallenge + applyPriorityChallenge only (spec §5, §6, §11).
export function promoteToPrimary(board: MissionBoard, missionId: string, now: string): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  if (!mission.finishLine) return fail(board, 'Mission needs an exact finish line before becoming Primary.')

  const existingPrimary = findByState(board, 'primary')
  if (existingPrimary && existingPrimary.id !== missionId) {
    return fail(board, 'A Primary mission is already active. Use a priority challenge to replace it.')
  }

  const next: Mission = { ...mission, state: 'primary', updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'promoted_primary', mission.title, now),
    error: null,
  }
}

// reason must be either the Primary being genuinely Blocked, or an explicit
// capacity-mismatch report against the Primary — no other path unlocks
// Secondary (spec §5).
export function promoteToSecondary(
  board: MissionBoard,
  missionId: string,
  reason: 'primary_blocked' | 'capacity_mismatch',
  now: string,
): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  if (!mission.finishLine) return fail(board, 'Mission needs an exact finish line before becoming Secondary.')

  const existingSecondary = findByState(board, 'secondary')
  if (existingSecondary && existingSecondary.id !== missionId) {
    return fail(board, 'A Secondary mission is already active. Use a priority challenge to replace it.')
  }

  const primary = findByState(board, 'primary')
  if (!primary) {
    return fail(board, 'Secondary cannot become actionable without an active Primary to be secondary to.')
  }
  if (reason === 'primary_blocked' && !primary.blocker) {
    return fail(board, 'Primary is not Blocked — Secondary is not actionable yet.')
  }
  if (reason === 'capacity_mismatch' && !primary.capacityMismatch) {
    return fail(board, 'No capacity mismatch has been reported against the Primary.')
  }

  const next: Mission = { ...mission, state: 'secondary', updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'promoted_secondary', `reason: ${reason}`, now),
    error: null,
  }
}

// ─── Blocker + capacity ─────────────────────────────────────────────────
// Being Blocked is not one of the ways a Primary stops being Primary (spec
// §5 lists only completed / deliberately paused / abandoned / replaced), so
// an active Primary or Secondary keeps its role and carries the blocker as
// a flag. The literal 'blocked' state is reserved for a Candidate or Parked
// mission that cannot proceed before ever holding a role.
export function reportBlocker(board: MissionBoard, missionId: string, blocker: string, now: string): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  if (mission.state === 'completed' || mission.state === 'paused' || mission.state === 'abandoned') {
    return fail(board, 'Completed, Paused, or Abandoned missions cannot be Blocked.')
  }
  const trimmed = blocker.trim()
  if (!trimmed) return fail(board, 'Blocker cannot be empty.')

  const nextState: MissionState =
    mission.state === 'primary' || mission.state === 'secondary' ? mission.state : 'blocked'
  const next: Mission = { ...mission, state: nextState, blocker: trimmed, updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'blocked', trimmed, now),
    error: null,
  }
}

export function unblock(board: MissionBoard, missionId: string, now: string): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  if (!mission.blocker && mission.state !== 'blocked') return fail(board, 'Mission is not Blocked.')

  // A Primary/Secondary that was blocked stays in its role; a literal
  // 'blocked' Candidate/Parked mission returns to Parked.
  const nextState: MissionState = mission.state === 'blocked' ? 'parked' : mission.state
  const next: Mission = { ...mission, state: nextState, blocker: null, updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'unblocked', `now ${nextState}`, now),
    error: null,
  }
}

export function reportCapacityMismatch(
  board: MissionBoard,
  missionId: string,
  capacity: CapacityLevel,
  now: string,
): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  if (mission.state !== 'primary') return fail(board, 'Capacity mismatch can only be reported against the Primary.')

  const next: Mission = { ...mission, capacityMismatch: true, updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'capacity_mismatch_reported', `reported capacity: ${capacity}`, now),
    error: null,
  }
}

// ─── Priority challenge ─────────────────────────────────────────────────
// requestPriorityChallenge never mutates the board — it produces a
// recommendation only. Replacing the Primary requires the separate, explicit
// applyPriorityChallenge call (spec §6: "does not silently replace the Primary").
export interface PriorityChallenge {
  candidateMissionId: string
  displacedMissionId: string
  what: string
  why: string
}

export function requestPriorityChallenge(
  board: MissionBoard,
  args: { candidateMissionId: string; displacedMissionId: string; what: string; why: string },
): { challenge: PriorityChallenge | null; error: string | null } {
  const what = args.what.trim()
  const why = args.why.trim()
  if (!what) return { challenge: null, error: 'Priority challenge must state what changes.' }
  if (!why) return { challenge: null, error: 'Priority challenge must state why it changes.' }
  if (!board.missions[args.candidateMissionId]) {
    return { challenge: null, error: `No candidate mission with id ${args.candidateMissionId}.` }
  }
  if (!board.missions[args.displacedMissionId]) {
    return { challenge: null, error: `No displaced mission with id ${args.displacedMissionId}.` }
  }

  return {
    challenge: {
      candidateMissionId: args.candidateMissionId,
      displacedMissionId: args.displacedMissionId,
      what,
      why,
    },
    error: null,
  }
}

export function applyPriorityChallenge(
  board: MissionBoard,
  challenge: PriorityChallenge,
  displacedNextState: 'parked' | 'paused' | 'abandoned',
  now: string,
): ActionResult {
  const candidate = board.missions[challenge.candidateMissionId]
  const displaced = board.missions[challenge.displacedMissionId]
  if (!candidate) return fail(board, `No candidate mission with id ${challenge.candidateMissionId}.`)
  if (!displaced) return fail(board, `No displaced mission with id ${challenge.displacedMissionId}.`)
  if (!candidate.finishLine) return fail(board, 'Candidate mission needs an exact finish line before promotion.')
  if (displaced.state !== 'primary' && displaced.state !== 'secondary') {
    return fail(board, 'Displaced mission is not currently Primary or Secondary.')
  }

  const displacedRole = displaced.state
  let next: MissionBoard = putMission(board, { ...displaced, state: displacedNextState, updatedAt: now })
  next = putMission(next, { ...candidate, state: displacedRole, updatedAt: now })

  return {
    board: next,
    event: makeEvent(
      candidate.id,
      'priority_challenge_applied',
      `${challenge.what} — ${challenge.why} — displaced ${displaced.title} to ${displacedNextState}`,
      now,
    ),
    error: null,
  }
}

// ─── Completion ─────────────────────────────────────────────────────────
// An agent's completion claim cannot complete a mission without evidence
// (spec §7, §9, §11: evidence-gated completion).
export function completeMission(
  board: MissionBoard,
  missionId: string,
  args: { evidenceConfirmed: boolean; evidenceDetail: string },
  now: string,
): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  if (!mission.finishLine) return fail(board, 'Mission has no finish line to complete against.')
  if (!args.evidenceConfirmed) {
    return fail(board, 'Mission cannot be completed without confirmed evidence.')
  }

  const next: Mission = { ...mission, state: 'completed', updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'completed', args.evidenceDetail, now),
    error: null,
  }
}

// ─── Pause / abandon ─────────────────────────────────────────────────────
export function pauseMission(board: MissionBoard, missionId: string, reason: string, now: string): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  const next: Mission = { ...mission, state: 'paused', updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'paused', reason.trim(), now),
    error: null,
  }
}

export function abandonMission(board: MissionBoard, missionId: string, reason: string, now: string): ActionResult {
  const mission = board.missions[missionId]
  if (!mission) return fail(board, `No mission with id ${missionId}.`)
  const next: Mission = { ...mission, state: 'abandoned', updatedAt: now }
  return {
    board: putMission(board, next),
    event: makeEvent(missionId, 'abandoned', reason.trim(), now),
    error: null,
  }
}

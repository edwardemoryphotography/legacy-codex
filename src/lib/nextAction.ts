import type { DeltaProvenance, Mission, StrategicDelta } from '@/types'

/**
 * Fixed-size, deterministic digest for bounded idempotency keys.
 * Not cryptographic; it only needs to make a long context safe for a B-tree
 * index while keeping the same identity stable across retries and reloads.
 */
export function stableHash(value: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  let h3 = 0xc2b2ae35
  let h4 = 0x27d4eb2f
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 0x01000193)
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b)
    h3 = Math.imul(h3 ^ (code << 3), 0x165667b1)
    h4 = Math.imul(h4 ^ (code << 5), 0x9e3779b1)
  }
  return [h1, h2, h3, h4]
    .map(value => (value >>> 0).toString(16).padStart(8, '0'))
    .join('')
}

/**
 * The one current next action for a mission.
 *
 * This is a projection over existing records, not a new source of truth:
 * - a saved commitment lives in `actions`
 * - an accepted prediction lives in `mission_events.delta_accepted`
 * - a predicted move lives only in the Delta for the current render
 *
 * A prediction is not a commitment. Acceptance is not a saved action. Saving is
 * the only path into `actions`. Completion is a report, not proof.
 */
export type NextActionState =
  | 'none'
  | 'needs_input'
  | 'predicted'
  | 'accepted'
  | 'saved'
  | 'in_progress'
  | 'completed'
  | 'superseded'

export type NextActionReadState = 'loading' | 'empty' | 'error' | 'loaded'

export interface SavedActionSnapshot {
  id: string
  missionId: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  resumeNote?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
}

export interface AcceptanceSnapshot {
  eventId: string
  missionId: string
  move: string
  candidateId?: string | null
  finishLine?: string | null
  contextKey?: string | null
  createdAt?: string | null
}

export interface NextAction {
  id: string
  missionId: string | null
  title: string
  context: string
  state: NextActionState
  /** Null when the provenance was never recorded (a saved action). */
  provenance: DeltaProvenance | null
  evidence: string | null
  question: string | null
  candidateId: string | null
  sourceHash: string | null
  sourceRefs: string[]
  canonicalActionId: string | null
  deltaEventId: string | null
  createdAt: string | null
  acceptedAt: string | null
  savedAt: string | null
  startedAt: string | null
  completedAt: string | null
  supersededBy: string | null
  readState: NextActionReadState
  stale: boolean
  staleReason: string | null
}

export interface DeriveNextActionInput {
  mission: Mission | null
  delta: StrategicDelta | null
  acceptance?: AcceptanceSnapshot | null
  savedAction?: SavedActionSnapshot | null
  readState?: NextActionReadState
  /** The canonical context key for the current render, when available. */
  contextKey?: string | null
  sourceRefs?: string[]
  now?: string
}

const NO_MISSION_TITLE = 'No next move yet'
const NO_MISSION_CONTEXT = 'Choose a mission first.'

function base(input: DeriveNextActionInput, overrides: Partial<NextAction>): NextAction {
  return {
    id: overrides.id ?? 'none',
    missionId: input.mission?.id ?? null,
    title: NO_MISSION_TITLE,
    context: NO_MISSION_CONTEXT,
    state: 'none',
    provenance: null,
    evidence: input.mission?.evidenceRequirement ?? null,
    question: null,
    candidateId: null,
    sourceHash: input.contextKey ?? null,
    sourceRefs: input.sourceRefs ?? [],
    canonicalActionId: null,
    deltaEventId: null,
    createdAt: input.now ?? null,
    acceptedAt: null,
    savedAt: null,
    startedAt: null,
    completedAt: null,
    supersededBy: null,
    readState: input.readState ?? 'loaded',
    stale: false,
    staleReason: null,
    ...overrides,
  }
}

function savedState(status: SavedActionSnapshot['status']): NextActionState {
  if (status === 'DONE') return 'completed'
  if (status === 'IN_PROGRESS') return 'in_progress'
  return 'saved'
}

/**
 * Whether the recorded acceptance still describes the prediction on screen.
 * Candidate id is the strongest signal; context key and finish line are the
 * compatibility path for older rows; move text is the legacy fallback.
 */
function acceptanceStaleness(
  acceptance: AcceptanceSnapshot,
  delta: StrategicDelta | null,
  mission: Mission,
  contextKey: string | null,
): string | null {
  // No fresh prediction is not evidence that the accepted move changed.
  // Mission will mark it stale if a recomputed Delta no longer matches.
  if (!delta) return null
  const reasons: string[] = []
  if (acceptance.candidateId && delta.candidateId && acceptance.candidateId !== delta.candidateId) {
    reasons.push('The prediction changed.')
  }
  if (acceptance.contextKey && contextKey && acceptance.contextKey !== contextKey) {
    reasons.push('The project context changed since you accepted this.')
  }
  if (acceptance.finishLine != null && mission.finishLine !== acceptance.finishLine) {
    reasons.push('The finish line changed.')
  }
  // Older rows have no candidate id, context key, or stored finish line.
  if (
    !acceptance.candidateId &&
    !acceptance.contextKey &&
    acceptance.finishLine == null &&
    acceptance.move !== delta.move
  ) {
    reasons.push('The prediction changed.')
  }
  return reasons[0] ?? null
}

/**
 * Derive the current move. Precedence is deliberate: a saved commitment
 * outranks a fresh prediction, because a prediction must never silently
 * replace something the human already saved.
 */
export function deriveNextAction(input: DeriveNextActionInput): NextAction {
  const readState = input.readState ?? 'loaded'

  if (readState === 'error') {
    return base(input, {
      id: `${input.mission?.id ?? 'none'}:error`,
      state: 'none',
      title: 'Could not read your next move',
      context: 'Your saved work has not been changed.',
      readState: 'error',
    })
  }

  if (readState === 'loading') {
    return base(input, {
      id: `${input.mission?.id ?? 'none'}:loading`,
      state: 'none',
      title: 'Reading your next move',
      context: 'Waiting for your saved project.',
      readState: 'loading',
    })
  }

  if (!input.mission) {
    return base(input, {
      id: 'no-mission',
      state: 'none',
      title: NO_MISSION_TITLE,
      context: NO_MISSION_CONTEXT,
      readState: 'empty',
    })
  }

  const mission = input.mission
  const saved = input.savedAction
  if (saved && saved.missionId === mission.id) {
    return base(input, {
      id: saved.id,
      state: savedState(saved.status),
      title: saved.title,
      context: 'The action you saved.',
      canonicalActionId: saved.id,
      createdAt: saved.createdAt ?? saved.updatedAt ?? null,
      savedAt: saved.createdAt ?? null,
      startedAt: saved.startedAt ?? null,
      completedAt: saved.completedAt ?? null,
    })
  }

  const acceptance = input.acceptance
  if (acceptance && acceptance.missionId === mission.id) {
    const staleReason = acceptanceStaleness(acceptance, input.delta, mission, input.contextKey ?? null)
    return base(input, {
      id: acceptance.eventId,
      state: 'accepted',
      title: acceptance.move,
      context: input.delta?.because ?? 'You accepted this move.',
      provenance: input.delta?.provenance ?? null,
      question: null,
      candidateId: acceptance.candidateId ?? input.delta?.candidateId ?? null,
      sourceHash: acceptance.contextKey ?? input.contextKey ?? null,
      deltaEventId: acceptance.eventId,
      createdAt: acceptance.createdAt ?? input.delta?.computedAt ?? null,
      acceptedAt: acceptance.createdAt ?? null,
      stale: staleReason !== null,
      staleReason,
    })
  }

  const delta = input.delta
  if (!delta || !delta.move.trim()) {
    return base(input, {
      id: `${mission.id}:none`,
      state: 'none',
      title: NO_MISSION_TITLE,
      context: 'No prediction is available yet.',
    })
  }

  if (delta.provenance === 'insufficient_context') {
    return base(input, {
      id: delta.candidateId ?? `${mission.id}:needs-input:${input.contextKey ?? delta.computedAt}`,
      state: 'needs_input',
      title: 'One thing needed',
      context: delta.because,
      provenance: delta.provenance,
      question: delta.move,
      candidateId: delta.candidateId,
      createdAt: delta.computedAt,
    })
  }

  return base(input, {
    id: delta.candidateId ?? `${mission.id}:prediction:${input.contextKey ?? delta.computedAt}`,
    state: 'predicted',
    title: delta.move,
    context: delta.because,
    provenance: delta.provenance,
    candidateId: delta.candidateId,
    createdAt: delta.computedAt,
  })
}

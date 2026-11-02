import { describe, expect, it } from 'vitest'
import type { Mission, StrategicDelta } from '@/types'
import {
  deriveNextAction,
  stableHash,
  type AcceptanceSnapshot,
  type SavedActionSnapshot,
} from './nextAction'

const mission: Mission = {
  id: 'm1',
  title: 'Ship the upload',
  why: 'It is the next proof.',
  finishLine: 'A file uploads and the document is readable.',
  evidenceRequirement: 'A merged PR and a live check.',
  state: 'primary',
  blocker: null,
  capacityMismatch: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

function delta(overrides: Partial<StrategicDelta> = {}): StrategicDelta {
  return {
    move: 'Draft the upload slice',
    candidateId: 'advance:m1',
    provenance: 'deterministic',
    situation: 'primary_active',
    missionId: 'm1',
    missionTitle: 'Ship the upload',
    because: 'Your finish line names one unresolved step.',
    currentReality: '“Ship the upload” is Primary.',
    blockingGap: null,
    evidenceState: 'none',
    inhibited: [],
    wouldChangeIf: 'The finish line changes.',
    proofSteps: [],
    assembledFrom: [],
    computedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function saved(overrides: Partial<SavedActionSnapshot> = {}): SavedActionSnapshot {
  return {
    id: 'a1',
    missionId: 'm1',
    title: 'Draft the upload slice',
    status: 'TODO',
    resumeNote: 'Start with the form.',
    createdAt: '2026-11-01T01:00:00.000Z',
    updatedAt: '2026-11-01T01:00:00.000Z',
    ...overrides,
  }
}

function accepted(overrides: Partial<AcceptanceSnapshot> = {}): AcceptanceSnapshot {
  return {
    eventId: 'e1',
    missionId: 'm1',
    move: 'Draft the upload slice',
    candidateId: 'advance:m1',
    finishLine: mission.finishLine,
    contextKey: 'context-1',
    createdAt: '2026-11-01T02:00:00.000Z',
    ...overrides,
  }
}

describe('stableHash', () => {
  it('is deterministic, bounded, and changes with the input', () => {
    const a = stableHash('a long acceptance identity '.repeat(500))
    const b = stableHash('a long acceptance identity '.repeat(500))
    const c = stableHash('a different acceptance identity')

    expect(a).toBe(b)
    expect(a).toHaveLength(32)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('deriveNextAction', () => {
  it('returns an error projection before any other state', () => {
    const result = deriveNextAction({
      mission,
      delta: delta(),
      savedAction: saved(),
      readState: 'error',
    })

    expect(result.readState).toBe('error')
    expect(result.state).toBe('none')
    expect(result.title).toBe('Could not read your next move')
    expect(result.canonicalActionId).toBeNull()
  })

  it('returns a loading projection before any other state', () => {
    const result = deriveNextAction({
      mission,
      delta: delta(),
      acceptance: accepted(),
      readState: 'loading',
    })

    expect(result.readState).toBe('loading')
    expect(result.state).toBe('none')
    expect(result.title).toBe('Reading your next move')
  })

  it('returns an empty projection when there is no mission', () => {
    const result = deriveNextAction({ mission: null, delta: null })

    expect(result.readState).toBe('empty')
    expect(result.state).toBe('none')
    expect(result.title).toBe('No next move yet')
  })

  it('lets a saved TODO action outrank a fresh prediction', () => {
    const result = deriveNextAction({
      mission,
      delta: delta({ move: 'A new prediction' }),
      savedAction: saved(),
    })

    expect(result.state).toBe('saved')
    expect(result.id).toBe('a1')
    expect(result.title).toBe('Draft the upload slice')
    expect(result.canonicalActionId).toBe('a1')
    expect(result.provenance).toBeNull()
    expect(result.stale).toBe(false)
  })

  it('maps in-progress and completed saved actions', () => {
    expect(deriveNextAction({ mission, delta: delta(), savedAction: saved({ status: 'IN_PROGRESS' }) }).state)
      .toBe('in_progress')
    expect(deriveNextAction({ mission, delta: delta(), savedAction: saved({ status: 'DONE' }) }).state)
      .toBe('completed')
  })

  it('does not invent saved-action timestamps', () => {
    const result = deriveNextAction({ mission, delta: delta(), savedAction: saved() })

    expect(result.savedAt).toBe('2026-11-01T01:00:00.000Z')
    expect(result.startedAt).toBeNull()
    expect(result.completedAt).toBeNull()
  })

  it('accepts a matching candidate even when the wording changed', () => {
    const result = deriveNextAction({
      mission,
      delta: delta({ move: 'Reworded move' }),
      acceptance: accepted(),
      contextKey: 'context-1',
    })

    expect(result.state).toBe('accepted')
    expect(result.id).toBe('e1')
    expect(result.title).toBe('Draft the upload slice')
    expect(result.deltaEventId).toBe('e1')
    expect(result.stale).toBe(false)
  })

  it('marks an acceptance stale when the context key changed', () => {
    const result = deriveNextAction({
      mission,
      delta: delta(),
      acceptance: accepted({ contextKey: 'old-context' }),
      contextKey: 'new-context',
    })

    expect(result.state).toBe('accepted')
    expect(result.stale).toBe(true)
    expect(result.staleReason).toBe('The project context changed since you accepted this.')
  })

  it('marks an acceptance stale when there is no prediction to compare against', () => {
    const result = deriveNextAction({
      mission,
      delta: null,
      acceptance: accepted(),
      contextKey: 'context-1',
    })

    expect(result.state).toBe('accepted')
    expect(result.stale).toBe(true)
    expect(result.staleReason).toBe('No current prediction is available to compare against.')
  })

  it('ignores an acceptance recorded for another mission', () => {
    const result = deriveNextAction({
      mission,
      delta: delta(),
      acceptance: accepted({ missionId: 'm2' }),
    })

    expect(result.state).toBe('predicted')
  })

  it('returns needs_input for an insufficient-context Delta', () => {
    const result = deriveNextAction({
      mission,
      delta: delta({
        move: 'What concrete step moves this forward?',
        candidateId: null,
        provenance: 'insufficient_context',
        because: 'The finish line is larger than one step.',
      }),
    })

    expect(result.state).toBe('needs_input')
    expect(result.title).toBe('One thing needed')
    expect(result.question).toBe('What concrete step moves this forward?')
    expect(result.provenance).toBe('insufficient_context')
  })

  it('returns predicted for a concrete move', () => {
    const result = deriveNextAction({ mission, delta: delta() })

    expect(result.state).toBe('predicted')
    expect(result.title).toBe('Draft the upload slice')
    expect(result.candidateId).toBe('advance:m1')
    expect(result.provenance).toBe('deterministic')
    expect(result.deltaEventId).toBeNull()
    expect(result.canonicalActionId).toBeNull()
  })

  it('returns none when there is no Delta and no acceptance', () => {
    const result = deriveNextAction({ mission, delta: null })

    expect(result.state).toBe('none')
    expect(result.title).toBe('No next move yet')
    expect(result.readState).toBe('loaded')
  })

  it('falls back to move text for a legacy acceptance', () => {
    const result = deriveNextAction({
      mission,
      delta: delta(),
      acceptance: accepted({ candidateId: null, contextKey: null, finishLine: null }),
    })

    expect(result.state).toBe('accepted')
    expect(result.stale).toBe(false)
  })

  it('marks a legacy acceptance stale when the move changed', () => {
    const result = deriveNextAction({
      mission,
      delta: delta({ move: 'A different move' }),
      acceptance: accepted({ candidateId: null, contextKey: null, finishLine: null }),
    })

    expect(result.state).toBe('accepted')
    expect(result.stale).toBe(true)
    expect(result.staleReason).toBe('The prediction changed.')
  })
})

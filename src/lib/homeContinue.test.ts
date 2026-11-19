import { describe, expect, it } from 'vitest'
import type { Mission } from '@/types'
import { deriveNextAction } from '@/lib/nextAction'
import { activeLessonCount, deriveHomeContinue, type HomeContinueInput } from '@/lib/homeContinue'

// Deterministic fixtures for a pure projection. They establish the wording
// rules only; they are not evidence about any real mission or owner session.
const mission: Mission = {
  id: 'm1', title: 'Ship the print store', why: 'It pays for the next shoot.', finishLine: 'One print sold to a stranger',
  evidenceRequirement: null, state: 'primary', blocker: null, capacityMismatch: false, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
}
const saved = (status: 'TODO' | 'IN_PROGRESS') => ({ id: 'a1', missionId: 'm1', title: 'Upload three prints', status })

function view(overrides: Partial<HomeContinueInput> & { savedStatus?: 'TODO' | 'IN_PROGRESS'; accepted?: boolean } = {}) {
  const { savedStatus, accepted, ...rest } = overrides
  const target = rest.mission === undefined ? mission : rest.mission
  const nextAction = deriveNextAction({
    readState: 'loaded', mission: target, delta: null,
    savedAction: savedStatus ? saved(savedStatus) : null,
    acceptance: accepted ? { eventId: 'e1', missionId: 'm1', move: 'Draft the store page' } : null,
  })
  return deriveHomeContinue({ readState: 'loaded', missionCount: 1, mission: target, nextAction, correctionCount: null, activeLessonCount: null, ...rest })
}

describe('deriveHomeContinue', () => {
  it('leads with the saved mission and its saved step', () => {
    const result = view({ savedStatus: 'TODO' })
    expect(result).toMatchObject({ status: 'saved', missionTitle: 'Ship the print store', stepTitle: 'Upload three prints', stepLabel: 'Saved next step · not started', cta: 'Start this step' })
  })

  it('offers to resume a step that is in progress', () => {
    expect(view({ savedStatus: 'IN_PROGRESS' })).toMatchObject({ status: 'in_progress', stepLabel: 'In progress', cta: 'Resume this step' })
  })

  it('never words an accepted suggestion as a saved commitment', () => {
    const result = view({ accepted: true })
    expect(result).toMatchObject({ status: 'accepted', stepTitle: 'Draft the store page', stepLabel: 'Suggestion you accepted · not saved yet', cta: 'Review and save this step' })
    expect(result.reasons.find(reason => reason.label === 'Where this step came from')?.text).toMatch(/not saved as a commitment/)
  })

  it('a saved step outranks an accepted suggestion', () => {
    expect(view({ savedStatus: 'TODO', accepted: true }).status).toBe('saved')
  })

  it('says plainly when no step is saved, and points at the blocker when one is', () => {
    expect(view()).toMatchObject({ status: 'no_step', stepTitle: null, cta: 'Choose a next step' })
    expect(view({ mission: { ...mission, blocker: 'Waiting on the lab' } })).toMatchObject({ status: 'no_step', blocker: 'Waiting on the lab', cta: 'Work on the blocker' })
  })

  it('does not call a step absent when accepted suggestions could not be read', () => {
    expect(view({ acceptanceKnown: false })).toMatchObject({ status: 'step_unknown', stepTitle: null, cta: 'Open Mission' })
    // A saved step is known regardless of that read.
    expect(view({ acceptanceKnown: false, savedStatus: 'TODO' }).status).toBe('saved')
  })

  it('points to Mission for confirming a lesson, whatever its origin', () => {
    expect(view({ activeLessonCount: 0 }).reasons.at(-1)?.text).toBe('None yet. A lesson appears here after you confirm one in Mission.')
  })

  it('never reports a step as complete or verified', () => {
    const text = JSON.stringify(view({ savedStatus: 'IN_PROGRESS' }))
    expect(text).not.toMatch(/\b(completed|verified|finished)\b/i)
    expect(text).toMatch(/has not checked whether it is done/)
  })

  it('gives only reasons a saved value backs', () => {
    const bare = view({ mission: { ...mission, why: '  ', finishLine: null } })
    expect(bare.reasons).toEqual([])
    const full = view({ savedStatus: 'TODO', resumeNote: 'Photos are in the Lightroom export folder.' })
    expect(full.reasons.map(reason => reason.label)).toEqual(['Done when', 'Why it matters', 'Your return note', 'Where this step came from'])
  })

  it('clips a long return note and says where the rest is', () => {
    const note = view({ savedStatus: 'TODO', resumeNote: 'x'.repeat(900) }).reasons.find(reason => reason.label === 'Your return note')!.text
    expect(note.length).toBeLessThan(330)
    expect(note).toMatch(/full note in Mission/)
  })

  it('treats an unread correction or lesson count as unknown, not zero', () => {
    expect(view({ correctionCount: null, activeLessonCount: null }).reasons.map(reason => reason.label)).not.toContain('Lessons carried forward')
    expect(view({ activeLessonCount: 0 }).reasons.at(-1)?.text).toMatch(/^None yet/)
  })

  it('describes lessons as supplied context, never as proof of a changed answer', () => {
    const text = view({ activeLessonCount: 2, correctionCount: 1 }).reasons.map(reason => reason.text).join(' ')
    expect(text).toMatch(/2 lessons you confirmed are available to Codex as context/)
    expect(text).toMatch(/not proof it changed an answer/)
    expect(text).toMatch(/one suggestion on this mission “not right”/)
  })

  it('separates loading, a failed read, an empty account and no chosen focus', () => {
    const none = deriveNextAction({ readState: 'empty', mission: null, delta: null })
    const base = { nextAction: none, mission: null, correctionCount: null, activeLessonCount: null }
    expect(deriveHomeContinue({ ...base, readState: 'loading', missionCount: 0 }).status).toBe('loading')
    expect(deriveHomeContinue({ ...base, readState: 'error', missionCount: 0 }).status).toBe('error')
    expect(deriveHomeContinue({ ...base, readState: 'empty', missionCount: 0 })).toMatchObject({ status: 'no_missions', cta: 'Name what matters' })
    expect(deriveHomeContinue({ ...base, readState: 'empty', missionCount: 3 })).toMatchObject({ status: 'no_primary', cta: 'Choose what matters now' })
  })
})

describe('activeLessonCount', () => {
  it('counts confirmed lessons minus the ones retired by id, wherever they are filed', () => {
    expect(activeLessonCount([
      { id: 'l1', type: 'delta_lesson_confirmed', detail: '{}' },
      { id: 'l2', type: 'delta_lesson_confirmed', detail: '{}' },
      { id: 'r1', type: 'delta_lesson_retired', detail: JSON.stringify({ lessonId: 'l1' }) },
      { id: 'r2', type: 'delta_lesson_retired', detail: 'not json' },
      { id: 'c1', type: 'delta_corrected', detail: '{}' },
    ])).toBe(1)
  })
})

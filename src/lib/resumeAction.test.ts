import { describe, expect, it } from 'vitest'
import { actionStatusLabel, resumableActions, savedAgo } from './resumeAction'
import type { SavedAction } from '@/types'

const action = (id: string, missionId: string, state: string, updatedAt: string, status: SavedAction['status'] = 'TODO'): SavedAction => ({
  id,
  mission_id: missionId,
  action_title: `Action ${id}`,
  status,
  resume_note: null,
  updated_at: updatedAt,
  mission: { title: `Mission ${missionId}`, state },
})

describe('resumableActions', () => {
  it('puts the Primary mission first, then Secondary, then newest', () => {
    const ordered = resumableActions([
      action('a', 'm-paused', 'paused', '2026-09-24T12:00:00Z'),
      action('b', 'm-secondary', 'secondary', '2026-09-24T09:00:00Z'),
      action('c', 'm-primary', 'primary', '2026-09-20T09:00:00Z'),
      action('d', 'm-blocked', 'blocked', '2026-09-24T11:00:00Z'),
    ], {})
    expect(ordered.map(a => a.id)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('leaves out DONE rows and actions on completed or abandoned missions', () => {
    const ordered = resumableActions([
      action('a', 'm1', 'primary', '2026-09-24T12:00:00Z', 'DONE'),
      action('b', 'm2', 'abandoned', '2026-09-24T12:00:00Z'),
      action('c', 'm3', 'completed', '2026-09-24T12:00:00Z'),
    ], {})
    expect(ordered).toEqual([])
  })

  it('reads mission title and state from the board when it has them', () => {
    const [first] = resumableActions([action('a', 'm1', 'parked', '2026-09-24T12:00:00Z')], {
      m1: { title: 'Renamed mission', state: 'primary' },
    })
    expect(first.mission).toEqual({ title: 'Renamed mission', state: 'primary' })
    expect(first.id).toBe('a')
  })
})

describe('actionStatusLabel', () => {
  it('tells paused from not started by the note', () => {
    expect(actionStatusLabel({ status: 'TODO', resume_note: 'stopped here' })).toBe('Paused')
    expect(actionStatusLabel({ status: 'TODO', resume_note: '  ' })).toBe('Not started yet')
    expect(actionStatusLabel({ status: 'IN_PROGRESS', resume_note: null })).toBe('In progress')
  })
})

describe('savedAgo', () => {
  const now = Date.parse('2026-09-24T12:00:00Z')
  it('describes recency plainly', () => {
    expect(savedAgo('2026-09-24T11:59:40Z', now)).toBe('just now')
    expect(savedAgo('2026-09-24T11:59:00Z', now)).toBe('1 minute ago')
    expect(savedAgo('2026-09-24T09:00:00Z', now)).toBe('3 hours ago')
    expect(savedAgo('2026-09-23T09:00:00Z', now)).toBe('yesterday')
    expect(savedAgo('2026-09-21T09:00:00Z', now)).toBe('3 days ago')
    expect(savedAgo('not a date', now)).toBe('')
  })
})

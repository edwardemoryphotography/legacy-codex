import { describe, expect, it } from 'vitest'
import { activeState, GROUP_OF_STATE, groupTerritory, lastActivity, reportedCapacity, type MissionEventLite, type OpenAction } from './territory'
import type { Mission, MissionState } from '@/types'

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'm1', title: 'Ship the thing', why: 'proof', finishLine: null, evidenceRequirement: null, state: 'primary',
    blocker: null, capacityMismatch: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', ...overrides,
  }
}
const action = (overrides: Partial<OpenAction> = {}): OpenAction => ({ id: 'a1', mission_id: 'm1', action_title: 'Email the lab', status: 'TODO', resume_note: null, ...overrides })
const event = (overrides: Partial<MissionEventLite> = {}): MissionEventLite => ({ mission_id: 'm1', type: 'unblocked', detail: '', created_at: '2026-01-03T00:00:00Z', ...overrides })

describe('GROUP_OF_STATE', () => {
  it('places every real mission state in exactly one group', () => {
    const states: MissionState[] = ['candidate', 'parked', 'primary', 'secondary', 'blocked', 'completed', 'paused', 'abandoned']
    expect(Object.keys(GROUP_OF_STATE).sort()).toEqual([...states].sort())
    expect(GROUP_OF_STATE.blocked).toBe('active')
    expect(GROUP_OF_STATE.parked).toBe('paused')
  })
})

describe('lastActivity', () => {
  it('takes the latest saved time across mission, action and its own events only', () => {
    expect(lastActivity(mission(), null, [])).toBe('2026-01-02T00:00:00Z')
    expect(lastActivity(mission(), action({ updated_at: '2026-01-05T00:00:00Z' }), [event()])).toBe('2026-01-05T00:00:00Z')
    expect(lastActivity(mission(), null, [event({ mission_id: 'other', created_at: '2027-01-01T00:00:00Z' })])).toBe('2026-01-02T00:00:00Z')
  })
})

describe('groupTerritory', () => {
  it('groups in a fixed order, drops empty groups, and sorts by last activity', () => {
    const groups = groupTerritory(
      [mission({ id: 'old', state: 'secondary', updatedAt: '2026-01-01T00:00:00Z' }), mission({ id: 'new', state: 'blocked', updatedAt: '2026-02-01T00:00:00Z' }), mission({ id: 'done', state: 'completed' })],
      [], [],
    )
    expect(groups.map(g => g.group)).toEqual(['active', 'completed'])
    expect(groups[0].cards.map(c => c.mission.id)).toEqual(['new', 'old'])
  })
})

describe('Active State', () => {
  it('reads the latest reported capacity level from Mission\'s own event detail', () => {
    const events = [
      event({ type: 'capacity_mismatch_reported', detail: 'reported capacity: medium', created_at: '2026-01-01T00:00:00Z' }),
      event({ type: 'capacity_mismatch_reported', detail: 'reported capacity: low', created_at: '2026-01-04T00:00:00Z' }),
    ]
    expect(reportedCapacity('m1', events)).toEqual({ level: 'low', at: '2026-01-04T00:00:00Z' })
    expect(reportedCapacity('m1', [event({ type: 'capacity_mismatch_reported', detail: 'garbled' })])).toBeNull()
  })

  it('uses the primary\'s unfinished action as next safe action and never invents one', () => {
    const missions = [mission({ capacityMismatch: true }), mission({ id: 'm2', state: 'secondary', title: 'Smaller one' })]
    const state = activeState(missions, [action()], [])
    expect(state.primary?.id).toBe('m1')
    expect(state.nextSafeAction?.action_title).toBe('Email the lab')
    expect(state.capacity).toMatchObject({ mismatch: true, reported: null, secondary: { id: 'm2' } })
    expect(activeState([mission({ state: 'candidate' })], [], [])).toMatchObject({ primary: null, nextSafeAction: null })
  })
})

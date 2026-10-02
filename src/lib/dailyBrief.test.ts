import { describe, expect, it } from 'vitest'
import {
  buildBriefDirective,
  missionToBriefContext,
  missionsToBriefContext,
  stalledMissions,
  type BriefMissionContext,
} from './dailyBrief'
import type { Mission } from '@/types'

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'm1',
    title: 'Ship the thing',
    why: 'It is the proof loop.',
    finishLine: 'Deployed and verified',
    evidenceRequirement: null,
    state: 'primary',
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('missionToBriefContext', () => {
  it('keeps only the fields the prompt needs, no id or timestamps', () => {
    const ctx = missionToBriefContext(mission())
    expect(ctx).toEqual({
      title: 'Ship the thing',
      state: 'primary',
      why: 'It is the proof loop.',
      finishLine: 'Deployed and verified',
      blocker: null,
      capacityMismatch: false,
    })
  })

  it('clips long fields rather than dropping them', () => {
    const longWhy = 'x'.repeat(500)
    const ctx = missionToBriefContext(mission({ why: longWhy }))
    expect(ctx.why.length).toBeLessThan(500)
    expect(ctx.why.endsWith('…')).toBe(true)
  })

  it('never fabricates a blocker or finish line that is null', () => {
    const ctx = missionToBriefContext(mission({ blocker: null, finishLine: null }))
    expect(ctx.blocker).toBeNull()
    expect(ctx.finishLine).toBeNull()
  })
})

describe('missionsToBriefContext', () => {
  it('caps the number of missions sent', () => {
    const many = Array.from({ length: 50 }, (_, i) => mission({ id: String(i), title: `m${i}` }))
    expect(missionsToBriefContext(many)).toHaveLength(40)
  })
})

describe('stalledMissions', () => {
  it('includes blocked missions', () => {
    const ctx = [missionToBriefContext(mission({ state: 'blocked', blocker: 'waiting on PR review' }))]
    expect(stalledMissions(ctx)).toHaveLength(1)
  })

  it('includes capacity-mismatched missions even if not blocked', () => {
    const ctx = [missionToBriefContext(mission({ state: 'primary', capacityMismatch: true }))]
    expect(stalledMissions(ctx)).toHaveLength(1)
  })

  it('excludes missions that are neither blocked nor capacity-mismatched', () => {
    const ctx = [missionToBriefContext(mission({ state: 'primary' }))]
    expect(stalledMissions(ctx)).toHaveLength(0)
  })
})

describe('buildBriefDirective', () => {
  it('refuses to brief when there are no missions, and does not invent one', () => {
    const directive = buildBriefDirective('daily_brief', [])
    expect(directive).toMatch(/no missions exist/i)
    expect(directive).toMatch(/do not invent/i)
  })

  it('daily_brief asks for the top 3 moves grounded in the supplied missions', () => {
    const ctx: BriefMissionContext[] = [missionToBriefContext(mission())]
    const directive = buildBriefDirective('daily_brief', ctx)
    expect(directive).toContain('Ship the thing')
    expect(directive).toMatch(/3 highest-leverage moves/i)
  })

  it('triage says so plainly when nothing is stalled, instead of manufacturing a problem', () => {
    const ctx: BriefMissionContext[] = [missionToBriefContext(mission({ state: 'primary' }))]
    const directive = buildBriefDirective('triage', ctx)
    expect(directive).toMatch(/none of these are blocked/i)
    expect(directive).toMatch(/do not invent/i)
  })

  it('triage lists only the stalled missions as the ones to unblock', () => {
    const ctx: BriefMissionContext[] = [
      missionToBriefContext(mission({ id: 'a', title: 'Blocked one', state: 'blocked', blocker: 'waiting on review' })),
      missionToBriefContext(mission({ id: 'b', title: 'Fine one', state: 'primary' })),
    ]
    const directive = buildBriefDirective('triage', ctx)
    expect(directive).toContain('Blocked one')
    expect(directive).toMatch(/waiting on review/)
  })

  it('question mode includes the question and falls back when blank', () => {
    const ctx: BriefMissionContext[] = [missionToBriefContext(mission())]
    expect(buildBriefDirective('question', ctx, 'What should I do today?')).toContain('What should I do today?')
    expect(buildBriefDirective('question', ctx, '   ')).toMatch(/what matters most right now/i)
  })
})

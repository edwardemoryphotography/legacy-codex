import { describe, expect, it } from 'vitest'
import {
  buildBriefDirective,
  missionToBriefContext,
  missionsToBriefContext,
  parseBriefTarget,
  presentBriefText,
  stalledMissions,
  UNKNOWN_LINE,
  type BriefMissionContext,
  type BriefTarget,
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

  it('keeps the actual question when no missions exist instead of asking for an empty brief', () => {
    const question = 'this text box doesnt even let me send it anywhere'
    const directive = buildBriefDirective('question', [], question)
    expect(directive).toContain(question)
    expect(directive).not.toMatch(/nothing to brief/)
    expect(directive).toMatch(/no saved missions/i)
  })
})

describe('Architect Scan and Break Wall directives', () => {
  const target = (overrides: Partial<BriefTarget> = {}): BriefTarget => ({ kind: 'mission', evidenceRequirement: null, action: null, ...overrides })

  it('architect writes the Unknown line verbatim for every empty saved field', () => {
    const ctx = missionToBriefContext(mission({ finishLine: null, blocker: null, why: '' }))
    const directive = buildBriefDirective('architect', [ctx], undefined, target())
    expect(directive).toContain(`Intended end-state: write exactly "Intended end-state: ${UNKNOWN_LINE}"`)
    expect(directive).toContain(`What's blocking: write exactly "What's blocking: ${UNKNOWN_LINE}"`)
    expect(directive).toContain(`Next safe action: write exactly "Next safe action: ${UNKNOWN_LINE}"`)
    expect(directive).toContain(`Real leverage: write exactly "Real leverage: ${UNKNOWN_LINE}"`)
    expect(directive).toMatch(/finish line, evidence requirement, blocker, unfinished action, why/)
  })

  it('architect grounds lines in saved fields and names the saved action as the next safe action', () => {
    const ctx = missionToBriefContext(mission({ blocker: 'waiting on print lab' }))
    const directive = buildBriefDirective('architect', [ctx], undefined, target({ evidenceRequirement: 'Order receipt', action: { title: 'Email the lab', status: 'TODO', resumeNote: null } }))
    expect(directive).toContain('Deployed and verified')
    expect(directive).toContain('Order receipt')
    expect(directive).toContain('waiting on print lab')
    expect(directive).toContain('Next safe action: name the unfinished saved action above')
    expect(directive).toContain('"Email the lab" (TODO)')
    expect(directive).not.toContain(`Intended end-state: write exactly`)
  })

  it('architect and unblock never include other missions', () => {
    const ctx = [missionToBriefContext(mission({ title: 'Chosen' })), missionToBriefContext(mission({ title: 'Other one' }))]
    for (const mode of ['architect', 'unblock'] as const) {
      const directive = buildBriefDirective(mode, ctx, undefined, target({ kind: mode === 'architect' ? 'mission' : 'blocker' }))
      expect(directive).toContain('Chosen')
      expect(directive).not.toContain('Other one')
    }
  })

  it('unblock targets exactly the chosen wall and allows NONE when ungroundable', () => {
    const ctx = missionToBriefContext(mission({ blocker: 'no tripod plate' }))
    expect(buildBriefDirective('unblock', [ctx], undefined, target({ kind: 'blocker' }))).toContain('Saved blocker: no tripod plate')
    const directive = buildBriefDirective('unblock', [ctx], undefined, target({ kind: 'action', action: { title: 'Pack the bag', status: 'IN_PROGRESS', resumeNote: 'lens cloth missing' } }))
    expect(directive).toContain('Saved unfinished action: "Pack the bag" (IN_PROGRESS) — resume note: lens cloth missing')
    expect(directive).toMatch(/30 minutes/)
    expect(directive).toContain('output exactly: NONE')
  })

  it('refuses to pick a mission when no target was given', () => {
    expect(buildBriefDirective('architect', [missionToBriefContext(mission())])).toMatch(/do not pick one/)
  })
})

describe('parseBriefTarget', () => {
  const ctx = missionToBriefContext(mission({ blocker: null }))

  it('accepts only kind "mission" for architect', () => {
    expect(parseBriefTarget('architect', { kind: 'mission' }, ctx)).toEqual({ target: { kind: 'mission', evidenceRequirement: null, action: null } })
    expect(parseBriefTarget('architect', { kind: 'blocker' }, ctx)).toHaveProperty('error')
  })

  it('rejects a Break Wall blocker the mission never saved, and a missing or finished action', () => {
    expect(parseBriefTarget('unblock', { kind: 'blocker' }, ctx)).toHaveProperty('error')
    expect(parseBriefTarget('unblock', { kind: 'action' }, ctx)).toHaveProperty('error')
    expect(parseBriefTarget('unblock', { kind: 'action', action: { title: 'Done thing', status: 'DONE' } }, ctx)).toHaveProperty('error')
    expect(parseBriefTarget('unblock', { kind: 'nonsense' }, ctx)).toHaveProperty('error')
  })

  it('clamps every target text field to 400 characters', () => {
    const parsed = parseBriefTarget('unblock', { kind: 'action', evidenceRequirement: 'e'.repeat(900), action: { title: 't'.repeat(900), status: 'TODO', resumeNote: 'n'.repeat(900) } }, ctx)
    if (!('target' in parsed)) throw new Error('expected a target')
    expect(parsed.target.evidenceRequirement).toHaveLength(400)
    expect(parsed.target.action?.title).toHaveLength(400)
    expect(parsed.target.action?.resumeNote).toHaveLength(400)
  })
})

describe('presentBriefText', () => {
  it('turns a Break Wall NONE into plain Unknown copy and leaves other text alone', () => {
    expect(presentBriefText('unblock', 'NONE')).toMatch(/^Unknown: nothing saved yet/)
    expect(presentBriefText('architect', 'NONE')).toBe('NONE')
    expect(presentBriefText('daily_brief', '')).toBe('No brief text returned.')
  })
})

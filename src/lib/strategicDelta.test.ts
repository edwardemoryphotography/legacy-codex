import { describe, expect, it } from 'vitest'
import type { DeltaCorrection, EvidenceRecord, Mission, MissionState } from '@/types'
import {
  assembleDeltaContext,
  generateCandidates,
  inhibit,
  predictStrategicDelta,
  routeSituation,
  summarizeEvidence,
} from './strategicDelta'

const NOW = '2026-09-01T12:00:00.000Z'

function mission(over: Partial<Mission> & { id: string; state: MissionState }): Mission {
  return {
    title: `Mission ${over.id}`,
    why: '',
    finishLine: null,
    evidenceRequirement: null,
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }
}

function evidence(over: Partial<EvidenceRecord> & { id: string; missionId: string }): EvidenceRecord {
  return {
    source: 'github',
    kind: 'merged_pr',
    status: 'verified',
    claim: 'PR merged',
    observedAt: NOW,
    fetchedAt: NOW,
    ...over,
  }
}

function correction(over: Partial<DeltaCorrection> & { correctedMove: string }): DeltaCorrection {
  return {
    id: 'c1',
    missionId: 'm1',
    reason: 'Not available this week',
    createdAt: NOW,
    ...over,
  }
}

describe('summarizeEvidence', () => {
  it('reports none for an empty set rather than guessing', () => {
    expect(summarizeEvidence([], NOW)).toBe('none')
  })

  it('treats an explicit conflict row as a conflict', () => {
    expect(summarizeEvidence([evidence({ id: 'e1', missionId: 'm1', status: 'conflict' })], NOW)).toBe('conflict')
  })

  it('treats two sources disagreeing as a conflict even when neither row is flagged', () => {
    const state = summarizeEvidence(
      [
        evidence({ id: 'e1', missionId: 'm1', source: 'github', status: 'verified' }),
        evidence({ id: 'e2', missionId: 'm1', source: 'notion', status: 'unverified' }),
      ],
      NOW,
    )
    expect(state).toBe('conflict')
  })

  it('reports stale when the only record is older than the staleness window', () => {
    const old = evidence({ id: 'e1', missionId: 'm1', fetchedAt: '2026-08-01T00:00:00.000Z' })
    expect(summarizeEvidence([old], NOW)).toBe('stale')
  })
})

describe('routeSituation', () => {
  const cases: Array<[string, Mission[], EvidenceRecord[], string]> = [
    ['empty when there is no mission state at all', [], [], 'empty'],
    [
      'no_primary_unready when missions exist but none names a finish line',
      [mission({ id: 'm1', state: 'parked' })],
      [],
      'no_primary_unready',
    ],
    [
      'no_primary_ready when a parked mission already has a finish line',
      [mission({ id: 'm1', state: 'parked', finishLine: 'Shipped' })],
      [],
      'no_primary_ready',
    ],
    [
      'primary_active when a Primary is set and nothing blocks it',
      [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' })],
      [],
      'primary_active',
    ],
    [
      'primary_blocked when the Primary carries a blocker',
      [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped', blocker: 'Waiting on Vaughn' })],
      [],
      'primary_blocked',
    ],
    [
      'evidence_conflict outranks a blocker — unverified state is the prior gate',
      [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped', blocker: 'Waiting on Vaughn' })],
      [evidence({ id: 'e1', missionId: 'm1', status: 'conflict' })],
      'evidence_conflict',
    ],
  ]

  it.each(cases)('routes to %s', (_name, missions, ev, expected) => {
    expect(routeSituation(assembleDeltaContext(missions, ev, [], NOW))).toBe(expected)
  })
})

describe('inhibition', () => {
  it('kills advancing a blocked Primary, and names the blocker as the reason', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped', blocker: 'Waiting on Vaughn' })]
    const ctx = assembleDeltaContext(missions, [], [], NOW)
    const { inhibited } = inhibit(generateCandidates(ctx), ctx)

    const killed = inhibited.find(c => c.id === 'advance:m1')
    expect(killed?.reason).toBe('blocked')
    expect(killed?.explanation).toContain('Waiting on Vaughn')
  })

  it('refuses to let a parked mission silently displace an active Primary', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' }),
      mission({ id: 'm2', state: 'parked', finishLine: 'Also shipped' }),
    ]
    const ctx = assembleDeltaContext(missions, [], [], NOW)
    const { inhibited } = inhibit(generateCandidates(ctx), ctx)

    const killed = inhibited.find(c => c.id === 'promote:m2')
    expect(killed?.reason).toBe('displaces_primary')
    expect(killed?.explanation).toContain('priority challenge')
  })

  it('kills every non-reconciling move while two sources disagree', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' })]
    const ev = [evidence({ id: 'e1', missionId: 'm1', status: 'conflict' })]
    const ctx = assembleDeltaContext(missions, ev, [], NOW)
    const { surviving, inhibited } = inhibit(generateCandidates(ctx), ctx)

    expect(surviving[0].id).toBe('reconcile:m1')
    expect(inhibited.every(c => c.id !== 'reconcile:m1')).toBe(true)
    expect(inhibited.some(c => c.reason === 'unverified_state')).toBe(true)
  })

  it('leaves exactly one surviving move', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' }),
      mission({ id: 'm2', state: 'parked', finishLine: 'Later' }),
      mission({ id: 'm3', state: 'parked' }),
    ]
    const ctx = assembleDeltaContext(missions, [], [], NOW)
    expect(inhibit(generateCandidates(ctx), ctx).surviving).toHaveLength(1)
  })
})

describe('predictStrategicDelta', () => {
  it('returns insufficient_context — not a guess — when there is no state to predict from', () => {
    const delta = predictStrategicDelta([], [], [], NOW)

    expect(delta.provenance).toBe('insufficient_context')
    expect(delta.situation).toBe('empty')
    expect(delta.missionId).toBeNull()
    // The empty state must still name the one missing input, not apologise.
    expect(delta.move).toContain('finish line')
    expect(delta.blockingGap).not.toBeNull()
  })

  it('predicts advancing the Primary when one is active and unblocked', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship the Delta', finishLine: 'Live on Vercel' })]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.provenance).toBe('deterministic')
    expect(delta.move).toBe('Move “Ship the Delta” toward: Live on Vercel')
    expect(delta.missionId).toBe('m1')
    expect(delta.blockingGap).toBeNull()
  })

  it('predicts clearing the blocker over advancing the Secondary, and keeps the Secondary visible as the alternative', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: 'Merged' }),
    ]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.move).toContain('Clear what')
    expect(delta.blockingGap).toBe('Waiting on Vaughn')
    const alternative = delta.inhibited.find(c => c.id === 'advance:m2')
    expect(alternative?.reason).toBe('lower_leverage')
    expect(delta.wouldChangeIf).toContain('Write the docs')
  })

  it('promotes the most recently worked ready mission when nothing is Primary', () => {
    const missions = [
      mission({ id: 'old', state: 'parked', title: 'Older', finishLine: 'Done', updatedAt: '2026-08-01T00:00:00.000Z' }),
      mission({ id: 'new', state: 'parked', title: 'Newer', finishLine: 'Done', updatedAt: '2026-08-30T00:00:00.000Z' }),
    ]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.missionId).toBe('new')
    expect(delta.move).toContain('Primary Mission')
  })

  it('asks for a finish line when missions exist but none names an end state', () => {
    const missions = [mission({ id: 'm1', state: 'parked', title: 'Vague idea' })]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.provenance).toBe('deterministic')
    expect(delta.move).toContain('exact finish line')
  })

  // §15 — correction is a first-class interaction: the corrected move must
  // stop being recommended, and the correction must remain visible as history.
  it('stops recommending a corrected move and surfaces the next-best one instead', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: 'Merged' }),
    ]
    const first = predictStrategicDelta(missions, [], [], NOW)
    const corrections = [correction({ correctedMove: first.move, reason: 'Vaughn is out; Beau is available' })]
    const second = predictStrategicDelta(missions, [], corrections, NOW)

    expect(second.move).not.toBe(first.move)
    expect(second.move).toContain('Write the docs')
    const recorded = second.inhibited.find(c => c.move === first.move)
    expect(recorded?.reason).toBe('corrected')
    expect(recorded?.explanation).toContain('Beau is available')
  })

  it('falls back to insufficient_context — never a guess — once every candidate is corrected', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live' })]
    const first = predictStrategicDelta(missions, [], [], NOW)
    const delta = predictStrategicDelta(missions, [], [correction({ correctedMove: first.move })], NOW)

    expect(delta.provenance).toBe('insufficient_context')
    expect(delta.move).toContain('what changed')
  })

  it('reports what it assembled from as counts, making no claim it cannot support', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Live' })]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.assembledFrom).toContain('1 Primary mission')
    expect(delta.assembledFrom).toContain('0 evidence records')
  })

  it('is pure — the same state at the same instant yields the same prediction', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Live' })]
    expect(predictStrategicDelta(missions, [], [], NOW)).toEqual(predictStrategicDelta(missions, [], [], NOW))
  })
})

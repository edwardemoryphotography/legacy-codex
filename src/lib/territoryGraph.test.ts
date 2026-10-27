import { describe, expect, it } from 'vitest'
import { buildTerritoryGraph, PER_KIND_LIMIT, type EvidenceLite } from './territoryGraph'
import type { MissionEventLite, OpenAction } from './territory'
import type { Mission } from '@/types'

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'm1', title: 'Alpha', why: '', finishLine: null, evidenceRequirement: null, state: 'primary', blocker: null,
    capacityMismatch: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
  }
}
const ev = (overrides: Partial<MissionEventLite & { id: string }>) => ({ id: 'e1', mission_id: 'm1', type: 'x', detail: '', created_at: '2026-01-01T00:00:00Z', ...overrides })
const action: OpenAction = { id: 'a1', mission_id: 'm1', action_title: 'Email the lab', status: 'TODO', resume_note: null }
const evidence: EvidenceLite = { id: 's1', mission_id: 'm1', kind: 'merged_pr', status: 'unverified', claim: 'PR merged', observed_at: '2026-01-01T00:00:00Z' }

describe('buildTerritoryGraph', () => {
  it('draws only saved relationships, each with its provenance', () => {
    const g = buildTerritoryGraph(
      [mission({ blocker: 'waiting on lab' })],
      [action],
      [ev({ id: 'L1', type: 'delta_lesson_confirmed', detail: JSON.stringify({ rule: 'Ship smaller' }) }), ev({ id: 'C1', type: 'delta_corrected', detail: JSON.stringify({ move: 'x', reason: 'Too big' }) })],
      [evidence],
    )
    expect(g.edges.map(e => [e.label, e.provenance])).toEqual([
      ['unfinished action', 'actions.mission_id'],
      ['blocker', 'missions.blocker'],
      ['confirmed lesson', 'mission_events · delta_lesson_confirmed'],
      ['correction', 'mission_events · delta_corrected'],
      ['evidence (unverified)', 'evidence_snapshots.mission_id'],
    ])
    expect(g.edges.every(e => e.from === 'mission:m1')).toBe(true)
  })

  it('never links two missions and drops retired lessons and unparseable details', () => {
    const g = buildTerritoryGraph(
      [mission(), mission({ id: 'm2', title: 'Beta' })],
      [],
      [
        ev({ id: 'L1', type: 'delta_lesson_confirmed', detail: JSON.stringify({ rule: 'Old rule' }) }),
        ev({ id: 'R1', type: 'delta_lesson_retired', detail: JSON.stringify({ lessonId: 'L1' }) }),
        ev({ id: 'L2', type: 'delta_lesson_confirmed', detail: 'not json' }),
      ],
      [],
    )
    expect(g.edges).toEqual([])
    expect(g.nodes.filter(n => n.kind === 'mission')).toHaveLength(2)
  })

  it('caps each kind per mission and lays out the same way every time', () => {
    const many = Array.from({ length: 6 }, (_, i) => ev({ id: `C${i}`, type: 'delta_corrected', detail: JSON.stringify({ reason: `r${i}` }) }))
    const a = buildTerritoryGraph([mission(), mission({ id: 'm2', title: 'Beta', state: 'paused' })], [], many, [])
    const b = buildTerritoryGraph([mission({ id: 'm2', title: 'Beta', state: 'paused' }), mission()], [], many, [])
    expect(a.edges.filter(e => e.label === 'correction')).toHaveLength(PER_KIND_LIMIT)
    expect(a.nodes).toEqual(b.nodes)
  })

  it('keeps a fully populated mission readable: no two drawn boxes overlap', () => {
    const kinds = ['delta_lesson_confirmed', 'delta_corrected'] as const
    const events = kinds.flatMap(type => Array.from({ length: 3 }, (_, i) => ev({ id: `${type}${i}`, type, detail: JSON.stringify({ rule: `rule ${i}`, reason: `reason ${i}` }) })))
    const snaps = Array.from({ length: 3 }, (_, i) => ({ ...evidence, id: `s${i}` }))
    const g = buildTerritoryGraph([mission({ blocker: 'b' }), mission({ id: 'm2', title: 'Beta', blocker: 'b' })], [action, { ...action, id: 'a2', mission_id: 'm2' }], events.concat(events.map(e => ({ ...e, id: `${e.id}x`, mission_id: 'm2' }))), snaps.concat(snaps.map(s => ({ ...s, id: `${s.id}x`, mission_id: 'm2' }))))
    expect(g.nodes.filter(n => n.missionId === 'm1')).toHaveLength(12)
    const box = (n: (typeof g.nodes)[number]) => (n.kind === 'mission' ? { w: 150, h: 44 } : { w: 112, h: 34 })
    for (const a of g.nodes) for (const b of g.nodes) {
      if (a === b) continue
      const overlap = Math.abs(a.x - b.x) < (box(a).w + box(b).w) / 2 && Math.abs(a.y - b.y) < (box(a).h + box(b).h) / 2
      expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false)
    }
  })
})

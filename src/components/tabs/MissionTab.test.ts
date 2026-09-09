import { describe, expect, it } from 'vitest'
import {
  missionToRow,
  rowToCorrection,
  rowToEvidence,
  rowToMission,
  type EvidenceRow,
  type MissionEventRow,
  type MissionRow,
} from './MissionTab'
import type { Mission } from '@/types'

// MissionTab.tsx is the only place that translates between missionLoop's
// camelCase Mission/MissionEvent domain shapes and the snake_case
// missions/mission_events tables. It has no other coverage: the engine
// (strategicDelta.test.ts) and the component (StrategicDelta.test.tsx) are
// both well tested, but nothing previously verified that a correction
// written to mission_events actually reads back the same way after reload
// — the exact mechanism "Not right" persistence depends on.

const baseMission: Mission = {
  id: 'm1',
  title: 'Ship the redesign',
  why: 'It matters',
  finishLine: 'Production deploy is live',
  evidenceRequirement: 'A merged PR',
  state: 'primary',
  blocker: null,
  capacityMismatch: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
}

describe('missionToRow / rowToMission', () => {
  it('round-trips every field losslessly', () => {
    const row = missionToRow(baseMission, 'user-1')
    const roundTripped = rowToMission({ ...row, created_at: baseMission.createdAt })
    expect(roundTripped).toEqual(baseMission)
  })

  it('preserves null blocker, null finishLine, and capacityMismatch through the row shape', () => {
    const mission: Mission = { ...baseMission, blocker: 'Waiting on review', finishLine: null, capacityMismatch: true }
    const row = missionToRow(mission, 'user-1')
    expect(row.blocker).toBe('Waiting on review')
    expect(row.finish_line).toBeNull()
    expect(row.capacity_mismatch).toBe(true)
    const roundTripped = rowToMission({ ...row, created_at: mission.createdAt })
    expect(roundTripped).toEqual(mission)
  })

  it('stamps the row with the given user id, not anything on the mission', () => {
    const row = missionToRow(baseMission, 'user-2')
    expect(row.user_id).toBe('user-2')
  })
})

describe('rowToEvidence', () => {
  it('maps snake_case evidence rows to the domain shape', () => {
    const row: EvidenceRow = {
      id: 'e1',
      mission_id: 'm1',
      source: 'github',
      kind: 'merged_pr',
      status: 'verified',
      claim: 'PR #78 merged',
      observed_at: '2026-09-07T00:00:00.000Z',
      fetched_at: '2026-09-07T01:00:00.000Z',
    }
    expect(rowToEvidence(row)).toEqual({
      id: 'e1',
      missionId: 'm1',
      source: 'github',
      kind: 'merged_pr',
      status: 'verified',
      claim: 'PR #78 merged',
      observedAt: '2026-09-07T00:00:00.000Z',
      fetchedAt: '2026-09-07T01:00:00.000Z',
    })
  })

  it('preserves a null mission_id (unlinked evidence)', () => {
    const row: EvidenceRow = {
      id: 'e2', mission_id: null, source: 'manual', kind: 'custom', status: 'unverified',
      claim: 'reported by hand', observed_at: '2026-09-01T00:00:00.000Z', fetched_at: '2026-09-01T00:00:00.000Z',
    }
    expect(rowToEvidence(row).missionId).toBeNull()
  })
})

describe('rowToCorrection', () => {
  const base: MissionEventRow = {
    id: 'evt-1',
    mission_id: 'm1',
    detail: '',
    created_at: '2026-09-07T12:00:00.000Z',
  }

  it('parses a correction round-tripped through mission_events.detail, candidateId included', () => {
    const detail = JSON.stringify({ move: 'Ping Vaughn', reason: "He's not available this week", candidateId: 'clause:0' })
    const row: MissionEventRow = { ...base, detail }
    expect(rowToCorrection(row)).toEqual({
      id: 'evt-1',
      missionId: 'm1',
      correctedMove: 'Ping Vaughn',
      candidateId: 'clause:0',
      reason: "He's not available this week",
      createdAt: '2026-09-07T12:00:00.000Z',
    })
  })

  it('leaves candidateId undefined for corrections recorded before ids were written', () => {
    const detail = JSON.stringify({ move: 'Ping Vaughn', reason: 'stale' })
    const row: MissionEventRow = { ...base, detail }
    const parsed = rowToCorrection(row)
    expect(parsed?.candidateId).toBeUndefined()
    expect(parsed?.correctedMove).toBe('Ping Vaughn')
  })

  it('returns null rather than throwing on malformed JSON, so one bad row cannot break the whole read', () => {
    const row: MissionEventRow = { ...base, detail: 'not json{' }
    expect(rowToCorrection(row)).toBeNull()
  })

  it('returns null when move or reason is missing or the wrong type', () => {
    expect(rowToCorrection({ ...base, detail: JSON.stringify({ reason: 'only reason' }) })).toBeNull()
    expect(rowToCorrection({ ...base, detail: JSON.stringify({ move: 'only move' }) })).toBeNull()
    expect(rowToCorrection({ ...base, detail: JSON.stringify({ move: 1, reason: 'x' }) })).toBeNull()
  })

  it('ignores a non-string candidateId rather than passing through a malformed value', () => {
    const detail = JSON.stringify({ move: 'Ping Vaughn', reason: 'stale', candidateId: 42 })
    const parsed = rowToCorrection({ ...base, detail })
    expect(parsed?.candidateId).toBeUndefined()
  })
})

describe('missionToRow / rowToMission — MissionRow field naming matches Supabase snake_case', () => {
  it('produces exactly the columns the missions table expects, no more, no less', () => {
    const row = missionToRow(baseMission, 'user-1') as MissionRow
    expect(Object.keys(row).sort()).toEqual(
      ['id', 'user_id', 'title', 'why', 'finish_line', 'evidence_requirement', 'state', 'blocker', 'capacity_mismatch', 'updated_at'].sort(),
    )
  })
})

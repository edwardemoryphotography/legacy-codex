import { describe, it, expect } from 'vitest'
import { isValidEvidenceRecord, parseEvidenceSnapshot, groupByMission, hasConflict, isStale } from './evidence'
import type { EvidenceRecord } from '@/types'

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: 'e1',
    missionId: 'm1',
    source: 'github:edwardemoryphotography/legacy-codex#42',
    kind: 'merged_pr',
    status: 'verified',
    claim: 'PR #42 merged with passing checks',
    observedAt: '2026-07-15T08:00:00.000Z',
    fetchedAt: '2026-07-15T08:05:00.000Z',
    ...overrides,
  }
}

describe('isValidEvidenceRecord', () => {
  it('accepts a well-formed record', () => {
    expect(isValidEvidenceRecord(record())).toBe(true)
  })

  it('rejects a record with an unknown kind', () => {
    expect(isValidEvidenceRecord({ ...record(), kind: 'vibes' })).toBe(false)
  })

  it('rejects a record with an unknown status', () => {
    expect(isValidEvidenceRecord({ ...record(), status: 'probably' })).toBe(false)
  })

  it('rejects a record with an unparsable observedAt', () => {
    expect(isValidEvidenceRecord({ ...record(), observedAt: 'not a date' })).toBe(false)
  })

  it('accepts a null missionId (evidence not yet linked to a mission)', () => {
    expect(isValidEvidenceRecord(record({ missionId: null }))).toBe(true)
  })
})

describe('parseEvidenceSnapshot', () => {
  it('parses a well-formed snapshot', () => {
    const raw = JSON.stringify({ generatedAt: '2026-07-15T08:05:00.000Z', records: [record()] })
    const result = parseEvidenceSnapshot(raw)
    expect('records' in result).toBe(true)
    if ('records' in result) expect(result.records.length).toBe(1)
  })

  it('errors on invalid JSON', () => {
    const result = parseEvidenceSnapshot('not json')
    expect('error' in result).toBe(true)
  })

  it('errors when generatedAt is missing', () => {
    const raw = JSON.stringify({ records: [record()] })
    const result = parseEvidenceSnapshot(raw)
    expect('error' in result).toBe(true)
  })

  it('errors when records exist but none are valid, rather than silently dropping them', () => {
    const raw = JSON.stringify({ generatedAt: '2026-07-15T08:05:00.000Z', records: [{ garbage: true }] })
    const result = parseEvidenceSnapshot(raw)
    expect('error' in result).toBe(true)
  })

  it('returns an empty but valid snapshot when records is absent', () => {
    const raw = JSON.stringify({ generatedAt: '2026-07-15T08:05:00.000Z' })
    const result = parseEvidenceSnapshot(raw)
    expect('records' in result).toBe(true)
    if ('records' in result) expect(result.records).toEqual([])
  })
})

describe('groupByMission', () => {
  it('groups records by missionId, including null (unlinked)', () => {
    const records = [record({ id: 'e1', missionId: 'm1' }), record({ id: 'e2', missionId: 'm1' }), record({ id: 'e3', missionId: null })]
    const groups = groupByMission(records)
    expect(groups.get('m1')?.length).toBe(2)
    expect(groups.get(null)?.length).toBe(1)
  })
})

describe('hasConflict — Notion and GitHub disagreeing must never be silently merged', () => {
  it('is false when all sources agree', () => {
    const records = [record({ source: 'github', status: 'verified' }), record({ source: 'notion', status: 'verified' })]
    expect(hasConflict(records)).toBe(false)
  })

  it('is true when one source is verified and another is not', () => {
    const records = [record({ source: 'github', status: 'verified' }), record({ source: 'notion', status: 'unverified' })]
    expect(hasConflict(records)).toBe(true)
  })

  it('is true when any record is explicitly flagged conflict', () => {
    expect(hasConflict([record({ status: 'conflict' })])).toBe(true)
  })
})

describe('isStale', () => {
  it('is false within the staleness window', () => {
    expect(isStale('2026-07-15T08:00:00.000Z', '2026-07-15T10:00:00.000Z')).toBe(false)
  })

  it('is true past the staleness window', () => {
    expect(isStale('2026-07-14T08:00:00.000Z', '2026-07-15T10:00:00.000Z')).toBe(true)
  })

  it('treats an unparsable timestamp as stale rather than trusting it', () => {
    expect(isStale('not a date', '2026-07-15T10:00:00.000Z')).toBe(true)
  })
})

import type { EvidenceRecord } from '@/types'
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { mergeEvidenceSnapshot } from '../../scripts/evidence-snapshot.mjs'

const snapshot = JSON.parse(readFileSync('public/notes/evidence-snapshot.json', 'utf8')) as { generatedAt: string; records: EvidenceRecord[] }
const repo = 'edwardemoryphotography/legacy-codex'
describe('Evidence continuity using the committed real GitHub snapshot', () => {
  it('preserves original observations on source failure and marks them stale', () => {
    const result = mergeEvidenceSnapshot(snapshot, [], [repo], [repo])
    expect(result.records).toHaveLength(snapshot.records.length)
    for (const original of snapshot.records) {
      const record = result.records.find(row => row.id === original.id)
      expect(record).toEqual({ ...original, status: 'stale' })
    }
  })
  it('never lets a retained stale record overwrite a successful observation', () => {
    const result = mergeEvidenceSnapshot(snapshot, snapshot.records, [repo], [])
    expect(result.records).toEqual(snapshot.records)
  })
  it('preserves the last observation when PR listing succeeds but its checks cannot be read', () => {
    const original = snapshot.records[0]
    const result = mergeEvidenceSnapshot(snapshot, snapshot.records, [repo], [], [original.id])
    expect(result.records.find(row => row.id === original.id)).toEqual({ ...original, status: 'stale' })
    expect(result.unavailableSources).toContain(`check-runs:${original.id}`)
  })
  it('keeps successfully read PR state alongside the last check observation on partial failure', () => {
    const original = snapshot.records[0]
    const observations = snapshot.records.map(row => ({ ...row, prReadSucceeded: true }))
    const result = mergeEvidenceSnapshot(snapshot, observations, [repo], [], [original.id])
    const preserved = result.records.find(row => row.id === original.id)!
    expect(preserved.kind).toBe(original.kind)
    expect(preserved.status).toBe('stale')
    expect(preserved.claim).toContain(original.claim)
    expect(preserved.observedAt).toBe(original.observedAt)
    expect(preserved.fetchedAt).toBe(original.fetchedAt)
    expect(preserved.previousCheckObservation).toEqual({ status: original.status, claim: original.claim, observedAt: original.observedAt, fetchedAt: original.fetchedAt })
  })
  it('refuses malformed prior data instead of silently erasing it', () => {
    expect(() => mergeEvidenceSnapshot(null, [], [repo], [repo])).toThrow()
  })
})

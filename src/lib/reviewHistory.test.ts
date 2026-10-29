import { describe, expect, it } from 'vitest'
import { historicalReview } from './reviewHistory'

describe('historical review', () => {
  it('retains a saved proposal after expiry without making it actionable', () => {
    const result = historicalReview(JSON.stringify({ missionId: 'm', reviewedAt: '2020-01-01T00:00:00Z', finishLine: 'goal', operation: 'next step', sourceIds: ['s'], sources: [{ id: 's', label: 'note' }] }), 'm')
    expect(result).toEqual({ reviewedAt: '2020-01-01T00:00:00Z', finishLine: 'goal', operation: 'next step', sources: [{ id: 's', label: 'note' }] })
  })
  it('rejects another mission or malformed data', () => {
    expect(historicalReview('{', 'm')).toBeNull()
    expect(historicalReview(JSON.stringify({ missionId: 'other' }), 'm')).toBeNull()
  })
})

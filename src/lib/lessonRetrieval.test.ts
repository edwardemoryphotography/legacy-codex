/** @vitest-environment node */
// Query-protocol checks only: no synthetic account records or live-data claims.
import { describe, expect, it, vi } from 'vitest'
import { loadConfirmedLessons } from './projectLessonsServer'
import { loadRouteLearning, parseRouteCorrection } from './routeLearningServer'
import { formatLearnedContext } from './learnedContext'
import type { projectUserClient } from './projectReviewServer'

type Client = ReturnType<typeof projectUserClient>
function unavailableClient(error: boolean) {
  const query = {
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: error ? new Error('Unavailable') : null }), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(),
  }
  return { client: { from: vi.fn(() => query) } as unknown as Client, query }
}
describe('Saved learning read boundaries without account fixtures', () => {
  it('fails closed on an unavailable lesson query rather than returning an empty learned state', async () => {
    const { client, query } = unavailableClient(true)
    await expect(loadConfirmedLessons(client, 'caller', [])).rejects.toThrow('Could not read')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'caller')
    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(query.range).toHaveBeenCalledWith(0, 99)
  })
  it('fails closed when durable correction history cannot be read', async () => {
    const { client, query } = unavailableClient(true)
    await expect(loadRouteLearning(client, 'caller')).rejects.toThrow('unavailable')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'caller')
    expect(query.eq).toHaveBeenCalledWith('type', 'task_route_corrected')
  })
  it('keeps malformed routing history out of the derived projection', () => {
    expect(parseRouteCorrection(null)).toBeNull()
    expect(parseRouteCorrection({ tokens: ['__proto__'], lane: 'execution' })).toBeNull()
    expect(parseRouteCorrection({ tokens: ['inspect'], lane: 'unrecognized' })).toBeNull()
  })
  it('describes the empty selection without claiming verified facts or unread history', () => {
    const context = formatLearnedContext([], [])
    expect(context).toContain('not verified facts or completion')
    expect(context).toContain('Do not claim unread history was inspected')
    expect(context).toContain('No complete active applicable rules fit or were returned')
  })
})

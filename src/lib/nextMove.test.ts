import { describe, expect, it } from 'vitest'
import type { NextMoveContext } from '@/types'
import { nextMoveContextExpiresAt, nextMoveContextKey, recommendNextMove } from './nextMove'

// Empty/error/loading contracts require no fabricated mission or evidence rows.
const unavailable: NextMoveContext = {
  mission: null, missionStatus: 'unavailable', evidence: [], evidenceStatus: 'unavailable',
}
const loadedWithoutPrimary: NextMoveContext = { ...unavailable, missionStatus: 'ready', evidenceStatus: 'ready' }

describe('recommendNextMove', () => {
  it('does not claim failed reads mean no Primary exists', () => {
    const result = recommendNextMove('', unavailable)
    expect(result.reason).toBe('mission_unavailable')
    expect(result.nextMove).toContain('Try connection again')
    expect(result.source).toBe('local-rules')
    expect(result.handoff).toContain('not committed or started')
  })

  it('asks one focus question only after the mission read succeeds', () => {
    const result = recommendNextMove('', loadedWithoutPrimary)
    expect(result.reason).toBe('no_primary')
    expect(result.kind).toBe('question')
    expect(result.nextMove.match(/\?/g)).toHaveLength(1)
  })

  it('does not treat a pending read as empty or failed', () => {
    const result = recommendNextMove('', { ...unavailable, missionStatus: 'loading' })
    expect(result.reason).toBe('loading')
    expect(result.nextMove).toContain('Wait')
  })

  it('does not route the actual lunch-break request to generic architecture', () => {
    // Verbatim excerpt supplied by Eddie in the repair's originating conversation.
    const intent = "I'm on my lunch break"
    const result = recommendNextMove(intent, unavailable)
    expect(result.reason).toBe('mission_unavailable')
    expect(result.handoff).toContain(intent)
    expect(result.handoff).not.toContain('Foundry — Architecture')
  })

  it('invalidates a result when context availability changes', () => {
    const now = new Date().toISOString()
    expect(nextMoveContextKey(unavailable, now)).not.toBe(nextMoveContextKey(loadedWithoutPrimary, now))
  })

  it('does not invalidate unchanged context just because it was reallocated', () => {
    const now = new Date().toISOString()
    expect(nextMoveContextKey(unavailable, now)).toBe(nextMoveContextKey({ ...unavailable, evidence: [] }, now))
  })

  it('does not schedule a freshness timer when there is no evidence', () => {
    expect(nextMoveContextExpiresAt(unavailable, new Date().toISOString())).toBeNull()
  })
})

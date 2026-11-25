import { describe, expect, it } from 'vitest'
import { liveVoicePresentation } from './liveVoiceState'

describe('liveVoicePresentation', () => {
  it('maps each live phase to one honest primary status', () => {
    expect(liveVoicePresentation('connecting').primary).toBe('Connecting')
    expect(liveVoicePresentation('listening').primary).toBe('Listening')
    expect(liveVoicePresentation('reasoning').primary).toBe('Codex is working')
    expect(liveVoicePresentation('responding').primary).toBe('Codex responding')
    expect(liveVoicePresentation('idle').primary).toBeNull()
  })

  it('distinguishes muted capture from listening and from processing', () => {
    const muted = liveVoicePresentation('listening', { muted: true })
    expect(muted.primary).toBe('Muted')
    expect(muted.recording).toBe(false)
    expect(muted.listening).toBe(false)
    expect(liveVoicePresentation('listening').listening).toBe(true)
    expect(liveVoicePresentation('reasoning').listening).toBe(false)
  })

  it('reports a genuine disconnection without faking a live phase', () => {
    const gone = liveVoicePresentation('listening', { disconnected: true })
    expect(gone.primary).toBe('Disconnected')
    expect(gone.recording).toBe(false)
    expect(gone.active).toBe(true)
  })
})

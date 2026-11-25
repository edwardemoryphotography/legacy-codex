/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import { recordPresentationTransition, transitionVoicePresentation } from './voicePresentation'

describe('voicePresentation state machine', () => {
  beforeEach(() => {
    delete window.__CODEX_VOICE_PRESENTATION_LOG__
  })

  it('transitions strictly on explicit user intent and session lifecycle', () => {
    expect(transitionVoicePresentation('inactive', 'session-start')).toBe('immersive-orb')
    // Repeated session-start while already in transcript does not clobber explicit view.
    expect(transitionVoicePresentation('transcript', 'session-start')).toBe('transcript')
    // Explicit user open/close toggles between orb and transcript.
    expect(transitionVoicePresentation('immersive-orb', 'open-transcript-button')).toBe('transcript')
    expect(transitionVoicePresentation('transcript', 'close-transcript-button')).toBe('immersive-orb')
    expect(transitionVoicePresentation('immersive-orb', 'open-transcript-swipe')).toBe('transcript')
    expect(transitionVoicePresentation('transcript', 'close-transcript-swipe')).toBe('immersive-orb')
    expect(transitionVoicePresentation('transcript', 'close-transcript-escape')).toBe('immersive-orb')
    // Cannot open transcript while inactive.
    expect(transitionVoicePresentation('inactive', 'open-transcript-button')).toBe('inactive')
    // Ending session always restores inactive state.
    expect(transitionVoicePresentation('transcript', 'session-end')).toBe('inactive')
    expect(transitionVoicePresentation('immersive-orb', 'session-end')).toBe('inactive')
  })

  it('records non-noop presentation transitions without private content', () => {
    expect(recordPresentationTransition('immersive-orb', 'immersive-orb', 'session-start')).toBeNull()
    const entry = recordPresentationTransition('inactive', 'immersive-orb', 'session-start')
    expect(entry).toMatchObject({ from: 'inactive', to: 'immersive-orb', trigger: 'session-start', userInitiated: true })
    expect(window.__CODEX_VOICE_PRESENTATION_LOG__).toHaveLength(1)
  })
})

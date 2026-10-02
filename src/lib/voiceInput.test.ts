import { describe, expect, it } from 'vitest'
import { appendVoiceTranscript, TASK_INPUT_LIMIT, voiceErrorMessage } from './voiceInput'

// Eddie's actual words; text contract checks, not a simulated microphone.
const actual = 'Implement that into the legacy Codex, please.'
describe('voice text boundaries', () => {
  it('preserves existing text and adds only supplied words', () => {
    expect(appendVoiceTranscript('Proceed', actual)).toBe(`Proceed ${actual}`)
    expect(appendVoiceTranscript('Proceed\n', actual)).toBe(`Proceed\n${actual}`)
    expect(appendVoiceTranscript(actual, '')).toBe(actual)
  })
  it('replaces cumulative interim results rather than duplicating them', () => {
    expect(appendVoiceTranscript('Proceed', 'Implement that')).toBe('Proceed Implement that')
    expect(appendVoiceTranscript('Proceed', actual)).toBe(`Proceed ${actual}`)
  })
  it('applies the same length boundary as typing', () => {
    const supplied = Array.from({ length: 60 }, () => actual).join(' ')
    expect(appendVoiceTranscript('Proceed', supplied)).toBe(`Proceed ${supplied}`.slice(0, TASK_INPUT_LIMIT))
  })
  it('describes browser error contracts without claiming capture', () => {
    expect(voiceErrorMessage('not-allowed')).toContain('denied')
    expect(voiceErrorMessage('audio-capture')).toContain('No microphone')
    expect(voiceErrorMessage('network')).toContain('could not connect')
    expect(voiceErrorMessage('no-speech')).toContain('No speech was detected')
  })
})

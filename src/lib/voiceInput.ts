/** Browser-owned transcripts only. Never add inferred or generated words. */
export const TASK_INPUT_LIMIT = 2000

export function appendVoiceTranscript(base: string, transcript: string): string {
  const spoken = transcript.trim()
  if (!spoken) return base
  return `${base}${base && !/\s$/.test(base) ? ' ' : ''}${spoken}`.slice(0, TASK_INPUT_LIMIT)
}

export function voiceErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed': return 'Microphone or speech access was denied. Allow access in your browser settings, or use keyboard dictation.'
    case 'audio-capture': return 'No microphone is available. Use keyboard dictation or type your task.'
    case 'network': return 'The browser’s speech service could not connect. Try again or use keyboard dictation.'
    case 'no-speech': return 'No speech was detected. Tap the microphone to try again.'
    case 'aborted': return 'Voice input stopped.'
    case 'language-not-supported': return 'The browser’s speech service does not support your language. Use keyboard dictation or type.'
    default: return 'Voice input is unavailable right now. Try again or use keyboard dictation.'
  }
}

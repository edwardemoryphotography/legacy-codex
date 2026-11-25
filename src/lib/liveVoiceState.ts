// One authoritative human-facing status for live voice. Several underlying
// states may coexist (mic capture, playback, model processing); this maps them
// to a single honest primary status and to orb cognition inputs.
export type LiveVoicePhase = 'idle' | 'connecting' | 'listening' | 'reasoning' | 'responding'

export type LiveVoicePresentation = {
  primary: string | null
  detail: string
  /** Genuine causes only: never a progress animation for its own sake. */
  orbCognition: 'settled' | 'deriving' | 'insufficient' | 'failed'
  recording: boolean
  listening: boolean
  active: boolean
}

export function liveVoicePresentation(
  phase: LiveVoicePhase,
  options: { muted?: boolean; disconnected?: boolean } = {},
): LiveVoicePresentation {
  const muted = Boolean(options.muted)
  if (options.disconnected && phase !== 'idle') {
    return { primary: 'Disconnected', detail: 'The live connection ended. Recovered conversation is still available.', orbCognition: 'failed', recording: false, listening: false, active: true }
  }
  switch (phase) {
    case 'connecting':
      return { primary: 'Connecting', detail: 'Opening a billed live session…', orbCognition: 'deriving', recording: false, listening: false, active: true }
    case 'listening':
      return muted
        ? { primary: 'Muted', detail: 'Microphone paused. The session is still connected and billed.', orbCognition: 'insufficient', recording: false, listening: false, active: true }
        : { primary: 'Listening', detail: 'Live · you can interrupt at any time.', orbCognition: 'insufficient', recording: true, listening: true, active: true }
    case 'reasoning':
      return { primary: 'Codex is working', detail: 'Consulting your saved Codex context.', orbCognition: 'deriving', recording: true, listening: false, active: true }
    case 'responding':
      return { primary: 'Codex responding', detail: 'Speaking the current answer.', orbCognition: 'settled', recording: true, listening: false, active: true }
    default:
      return { primary: null, detail: 'Live voice is off.', orbCognition: 'insufficient', recording: false, listening: false, active: false }
  }
}

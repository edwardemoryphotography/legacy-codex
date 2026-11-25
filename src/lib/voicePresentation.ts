/**
 * Strictly separates live voice PRESENTATION state from voice SESSION state.
 *
 * Session events (connecting, listening, reasoning, responding, interrupted,
 * transcript deltas, model replies, mute toggles, theme switches, or window
 * resizes) MUST NEVER open or close the transcript layer or exit immersive
 * voice mode. Only explicit user intent (or session start/end) can transition
 * presentation mode.
 */

export type VoicePresentationMode = 'inactive' | 'immersive-orb' | 'transcript'

export type VoicePresentationTrigger =
  | 'session-start'
  | 'session-end'
  | 'open-transcript-button'
  | 'open-transcript-swipe'
  | 'close-transcript-button'
  | 'close-transcript-swipe'
  | 'close-transcript-escape'

export interface VoicePresentationTransition {
  at: string
  from: VoicePresentationMode
  to: VoicePresentationMode
  trigger: VoicePresentationTrigger
  userInitiated: boolean
}

const USER_INITIATED_TRIGGERS = new Set<VoicePresentationTrigger>([
  'session-start',
  'open-transcript-button',
  'open-transcript-swipe',
  'close-transcript-button',
  'close-transcript-swipe',
  'close-transcript-escape',
])

const MAX_TRANSITION_LOG = 100

declare global {
  interface Window {
    __CODEX_VOICE_PRESENTATION_LOG__?: VoicePresentationTransition[]
  }
}

export function transitionVoicePresentation(
  current: VoicePresentationMode,
  trigger: VoicePresentationTrigger,
): VoicePresentationMode {
  switch (trigger) {
    case 'session-start':
      return current === 'inactive' ? 'immersive-orb' : current
    case 'session-end':
      return 'inactive'
    case 'open-transcript-button':
    case 'open-transcript-swipe':
      return current === 'immersive-orb' ? 'transcript' : current
    case 'close-transcript-button':
    case 'close-transcript-swipe':
    case 'close-transcript-escape':
      return current === 'transcript' ? 'immersive-orb' : current
    default:
      return current
  }
}

/** Records presentation-only transition metadata (never transcript text or secrets). */
export function recordPresentationTransition(
  from: VoicePresentationMode,
  to: VoicePresentationMode,
  trigger: VoicePresentationTrigger,
  explicitUserInitiated?: boolean,
): VoicePresentationTransition | null {
  if (from === to) return null
  const entry: VoicePresentationTransition = {
    at: new Date().toISOString(),
    from,
    to,
    trigger,
    userInitiated: explicitUserInitiated ?? USER_INITIATED_TRIGGERS.has(trigger),
  }
  if (typeof window !== 'undefined') {
    const existing = Array.isArray(window.__CODEX_VOICE_PRESENTATION_LOG__)
      ? window.__CODEX_VOICE_PRESENTATION_LOG__
      : []
    window.__CODEX_VOICE_PRESENTATION_LOG__ = [...existing, entry].slice(-MAX_TRANSITION_LOG)
  }
  return entry
}

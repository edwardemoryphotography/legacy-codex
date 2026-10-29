/** Presentation only. No timers, audio invention, writes, or workflow transitions. */
export type OrbPresentationState = 'idle' | 'listening' | 'thinking' | 'ready' | 'blocked' | 'completed'
export function orbPresentation(input: { cognition: string; recording: boolean; interaction: string }) : { state: OrbPresentationState; label: string } {
  if (input.interaction === 'listening') return { state: 'listening', label: 'Listening to your task. Audio levels are not available.' }
  if (input.recording) return { state: 'thinking', label: 'Saving your change…' }
  if (input.cognition === 'failed') return { state: 'blocked', label: 'Codex could not proceed. Review the error and available actions.' }
  if (['reconstructing', 'deriving', 'correcting'].includes(input.cognition)) return { state: 'thinking', label: 'Codex is processing your mission…' }
  if (input.cognition === 'insufficient') return { state: 'idle', label: 'Codex is available. More context may be needed.' }
  if (input.cognition === 'accepted') return { state: 'ready', label: 'Your next move is accepted. It is not completed work.' }
  if (input.cognition === 'settled') return { state: 'ready', label: 'Review the next move and choose what to do.' }
  return { state: 'idle', label: 'Codex is available.' }
}

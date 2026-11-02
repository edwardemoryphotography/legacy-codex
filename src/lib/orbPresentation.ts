/** Presentation only. No timers, audio invention, writes, or workflow transitions. */
export type OrbPresentationState = 'idle' | 'listening' | 'thinking' | 'acting' | 'ready' | 'blocked' | 'completed'
export function orbPresentation(input: { cognition: string; recording: boolean; interaction: string; operation?: string | null }) : { state: OrbPresentationState; label: string } {
  if (input.interaction === 'listening') return { state: 'listening', label: 'Listening to your task. Audio levels are not available.' }
  if (input.cognition === 'failed') return { state: 'blocked', label: 'Request failed. Your work is still here.' }
  if (input.operation) return { state: 'acting', label: input.operation }
  if (input.recording) return { state: 'acting', label: 'Saving your change…' }
  if (input.cognition === 'reconstructing') return { state: 'acting', label: 'Reading saved mission context…' }
  if (input.cognition === 'correcting') return { state: 'acting', label: 'Recording your correction…' }
  if (input.cognition === 'deriving') return { state: 'thinking', label: 'Thinking' }
  if (input.cognition === 'insufficient') return { state: 'idle', label: 'Codex is available. More context may be needed.' }
  if (input.cognition === 'accepted') return { state: 'ready', label: 'Your next move is accepted. It is not completed work.' }
  if (input.cognition === 'settled') return { state: 'ready', label: 'Review the next move and choose what to do.' }
  return { state: 'idle', label: 'Codex is available.' }
}

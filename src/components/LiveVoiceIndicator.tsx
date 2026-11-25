'use client'

import { liveVoicePresentation } from '@/lib/liveVoiceState'
import { useLiveVoice } from '@/lib/liveVoiceContext'
import styles from './LiveVoiceIndicator.module.css'

/**
 * Persistent voice status/controls shown while the live session survives
 * navigation. Hidden on screens that already render the in-dock controls.
 * Visual direction belongs to the Living Intelligence redesign; this uses the
 * existing glass tokens and never invents a stage.
 */
export default function LiveVoiceIndicator({ hidden, onReturn }: { hidden: boolean; onReturn: () => void }) {
  const { state, controls } = useLiveVoice()
  const presentation = liveVoicePresentation(state.phase, { muted: state.muted, disconnected: state.disconnected })
  if (hidden || !presentation.active) return null
  return (
    <div className={styles.bar} role="status" aria-live="polite" data-live-voice="persistent">
      <span className={styles.dot} data-state={presentation.primary?.toLowerCase().replace(/\s+/g, '-')} aria-hidden="true" />
      <span className={styles.copy}>
        <strong>{presentation.primary}</strong>
        <span>{presentation.detail}</span>
      </span>
      <span className={styles.actions}>
        <button type="button" className="glass-chip glass" onClick={controls?.toggleMute}>{state.muted ? 'Unmute' : 'Mute'}</button>
        <button type="button" className="glass-chip glass" onClick={onReturn}>Voice</button>
        <button type="button" className="glass-chip glass" onClick={controls?.end}>End</button>
      </span>
    </div>
  )
}

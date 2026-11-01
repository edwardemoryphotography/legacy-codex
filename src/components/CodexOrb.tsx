'use client'

import { Orb } from '@/vendor/ai-orb/orb'
import type { OrbPresentationState } from '@/lib/orbPresentation'

/** The canonical one orb now uses AI-Orb's real Aurora finish (MIT).
 * OrbHost alone owns the mount and drives state from real app operations.
 * There is no synthetic microphone/output level and no speaking state until
 * Codex has an actual stream to connect. Ember remains reserved for verified
 * cross-project inheritance, not for replies or candidate connections. */
export type CodexOrbState = 'idle' | 'listening' | 'thinking'

export function codexOrbState(state: OrbPresentationState): CodexOrbState {
  if (state === 'listening' || state === 'thinking') return state
  return 'idle'
}

const CODEX_AURORA: [string, string, string] = ['#6A5CFF', '#22D3BE', '#A0A5FF']

export default function CodexOrb({ state }: { state: OrbPresentationState }) {
  return (
    <div className="codex-orb-stage" aria-hidden="true">
      <Orb
        className="codex-orb"
        finish="aurora"
        field="dark"
        state={codexOrbState(state)}
        colors={CODEX_AURORA}
        bodyColor="#0D0F22"
        pointerReactive={false}
        label="Codex presence"
      />
    </div>
  )
}

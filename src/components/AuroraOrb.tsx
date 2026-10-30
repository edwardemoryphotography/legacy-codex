'use client'

import { useEffect, useState } from 'react'
import { Orb } from '@/vendor/ai-orb/orb'
import type { OrbState } from '@/vendor/ai-orb/types'
import type { OrbPresentationState } from '@/lib/orbPresentation'

/** Codex states → AI-Orb states. `speaking` is never used: Codex has no real
 *  spoken reply, so nothing may claim one. Ready/blocked/completed rest in
 *  idle; their meaning is carried by the live status text, not the orb. */
export function aiOrbState(state: OrbPresentationState): OrbState {
  if (state === 'listening' || state === 'thinking') return state
  return 'idle'
}

/** Codex's own calm control (`data-reduced-motion` on <html>). The OS
 *  reduced-motion setting is handled inside the vendored Orb. */
function useCalmSetting() {
  const [calm, setCalm] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setCalm(root.dataset.reducedMotion === 'true')
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    return () => observer.disconnect()
  }, [])
  return calm
}

/** AI-Orb's Aurora finish. Decorative: the host's live status text is the
 *  accessible description. No level source is passed, so motion never
 *  pretends to follow audio. Calm or reduced motion renders one still frame. */
export default function AuroraOrb({ state }: { state: OrbPresentationState }) {
  const calm = useCalmSetting()
  return (
    <div className="ai-orb-stage" aria-hidden="true">
      <Orb finish="aurora" state={aiOrbState(state)} still={calm} className="ai-orb" />
    </div>
  )
}

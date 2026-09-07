'use client'

import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'

export default function ActivityOrb({ state = 'breathing', size = 64, active = false }: {
  state?: OrbState
  size?: 64 | 20
  active?: boolean
}) {
  const motionAllowed = useMotionAllowed()
  return <ThinkingOrb state={state} size={size} theme="dark" paused={!active || !motionAllowed} aria-hidden="true" />
}

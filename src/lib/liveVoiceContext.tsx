'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LiveVoicePhase } from './liveVoiceState'

export type LiveVoiceControls = { end: () => void; toggleMute: () => void }
type LiveVoiceState = { phase: LiveVoicePhase; muted: boolean; disconnected: boolean }

type LiveVoiceValue = {
  state: LiveVoiceState
  report: (next: Partial<LiveVoiceState>) => void
  register: (controls: LiveVoiceControls | null) => void
  controls: LiveVoiceControls | null
  /** True while the transport is mounted above the screens (ownership check). */
  persistent: true
}

const LiveVoiceContext = createContext<LiveVoiceValue | null>(null)
const IDLE: LiveVoiceState = { phase: 'idle', muted: false, disconnected: false }

export function LiveVoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveVoiceState>(IDLE)
  const controlsRef = useRef<LiveVoiceControls | null>(null)
  const [controls, setControls] = useState<LiveVoiceControls | null>(null)
  const report = useCallback((next: Partial<LiveVoiceState>) => setState(current => ({ ...current, ...next })), [])
  const register = useCallback((next: LiveVoiceControls | null) => {
    controlsRef.current = next
    setControls(next)
  }, [])
  const value = useMemo(() => ({ state, report, register, controls, persistent: true as const }), [state, report, register, controls])
  return <LiveVoiceContext.Provider value={value}>{children}</LiveVoiceContext.Provider>
}

const DETACHED: LiveVoiceValue = {
  state: IDLE,
  report: () => {},
  register: () => {},
  controls: null,
  persistent: true,
}

/** Safe outside the provider (screen-level tests, isolated previews). */
export function useLiveVoice(): LiveVoiceValue {
  return useContext(LiveVoiceContext) ?? DETACHED
}

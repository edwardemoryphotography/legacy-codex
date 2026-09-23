'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import CognitionField from '@/components/CognitionField'

export type OrbCognition = {
  cognition: string
  provenance: string
  recording: boolean
}

type OrbHostValue = {
  /** True only while Mission is the screen that should hold the field.
   *  CodexApp passes this in the same render that unmounts the slot, so
   *  the field leaves the slot before that node is removed. */
  placed: boolean
  slot: HTMLElement | null
  setSlot: (node: HTMLElement | null) => void
  cognition: OrbCognition | null
  setCognition: (next: OrbCognition | null) => void
}

const OrbHostContext = createContext<OrbHostValue | null>(null)

const RESTING: OrbCognition = {
  cognition: 'insufficient',
  provenance: 'insufficient_context',
  recording: false,
}

export function OrbHostProvider({
  placed = false,
  children,
}: {
  placed?: boolean
  children: ReactNode
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [cognition, setCognition] = useState<OrbCognition | null>(null)
  const value = useMemo(
    () => ({ placed, slot, setSlot, cognition, setCognition }),
    [placed, slot, cognition],
  )
  return <OrbHostContext.Provider value={value}>{children}</OrbHostContext.Provider>
}

/** The one field. On Mission it fills the Strategic Delta slot. Everywhere
 *  else it docks at the top of the shell, still the same node. */
export function PersistentOrb() {
  const host = useContext(OrbHostContext)
  if (!host) return null
  const live = host.cognition ?? RESTING
  const inSlot = host.placed && host.slot
  const node = (
    <div
      className={inSlot ? 'sd-orb-host sd-orb-hero' : 'sd sd-orb-host sd-orb-dock'}
      data-cognition={inSlot ? undefined : live.cognition}
      data-provenance={inSlot ? undefined : live.provenance}
      data-recording={!inSlot && live.recording ? 'true' : undefined}
    >
      <CognitionField />
    </div>
  )
  if (inSlot && host.slot) return createPortal(node, host.slot)
  return node
}

/** Placeholder in the Strategic Delta stage. Without a provider the field
 *  stays inline, so an isolated render still has one orb. */
export function OrbSlot() {
  const host = useContext(OrbHostContext)
  const setSlot = useRef(host?.setSlot)
  setSlot.current = host?.setSlot
  const ref = useCallback((node: HTMLDivElement | null) => {
    setSlot.current?.(node)
  }, [])
  if (!host) return <CognitionField />
  return <div className="sd-field-slot" ref={ref} />
}

/** Mission publishes the cognition the shell orb is allowed to show.
 *  Leaving mid-read settles the companion instead of freezing it on work
 *  that is no longer on screen. */
export function useOrbCognition(next: OrbCognition) {
  const host = useContext(OrbHostContext)
  const nextRef = useRef(next)
  nextRef.current = next
  const setRef = useRef(host?.setCognition)
  setRef.current = host?.setCognition

  useEffect(() => {
    setRef.current?.(nextRef.current)
  }, [next.cognition, next.provenance, next.recording])

  useEffect(() => {
    return () => {
      const current = nextRef.current
      const pending = current.recording
        || current.cognition === 'reconstructing'
        || current.cognition === 'deriving'
        || current.cognition === 'correcting'
      setRef.current?.(pending
        ? {
            cognition: current.provenance === 'insufficient_context' ? 'insufficient' : 'settled',
            provenance: current.provenance,
            recording: false,
          }
        : current)
    }
  }, [])
}

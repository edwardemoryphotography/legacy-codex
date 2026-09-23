'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import CognitionField from '@/components/CognitionField'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'

export type OrbCognition = {
  cognition: string
  provenance: string
  recording: boolean
}

type OrbHostValue = {
  /** True only while Mission is the screen that should hold the field.
   *  CodexApp passes this in the same render that unmounts the slot, so
   *  the field starts docking in the same commit the slot goes away. */
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

// Transform-only glide between the Mission slot and the dock. Duration and
// curve match --sd-dur-reveal / --sd-ease-settle in globals.css.
const GLIDE_MS = 560
const GLIDE_EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'

/** Layout offset of `el` inside `ancestor`'s padding box. Offsets ignore
 *  transforms, so a panel's enter animation cannot leave the field parked
 *  at a mid-animation position. Falls back to rects when `ancestor` is not
 *  on the offsetParent chain. */
function offsetWithin(el: HTMLElement, ancestor: Element | null): { left: number; top: number } {
  let left = 0
  let top = 0
  let current: HTMLElement | null = el
  while (current && current !== ancestor) {
    left += current.offsetLeft
    top += current.offsetTop
    const next = current.offsetParent as HTMLElement | null
    if (next && next !== ancestor) {
      left += next.clientLeft
      top += next.clientTop
    }
    current = next
  }
  if (current === ancestor && ancestor) return { left, top }
  const a = ancestor?.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return { left: r.left - (a?.left ?? 0), top: r.top - (a?.top ?? 0) }
}

/** The one field. It is rendered once, always at this same place in the
 *  tree, so tab changes never remount it or restart its motion — the old
 *  portal/inline switch did both. On Mission it is positioned over the
 *  Strategic Delta slot (absolute, so native scrolling carries it); on
 *  every other screen it docks at the top (fixed). Moving between the two
 *  is a transform-only glide from where it was to where it lands. */
export function PersistentOrb() {
  const host = useContext(OrbHostContext)
  const nodeRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<'hero' | 'dock' | null>(null)
  const motionAllowed = useMotionAllowed()
  const slot = host?.placed ? host.slot : null

  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const mode = slot ? 'hero' : 'dock'
    const previous = modeRef.current
    const from = previous && previous !== mode ? node.getBoundingClientRect() : null

    function place() {
      if (!node) return
      if (!slot) {
        node.style.removeProperty('left')
        node.style.removeProperty('top')
        node.style.removeProperty('width')
        node.style.removeProperty('height')
        return
      }
      const at = offsetWithin(slot, node.offsetParent)
      node.style.left = `${at.left}px`
      node.style.top = `${at.top}px`
      node.style.width = `${slot.offsetWidth}px`
      node.style.height = `${slot.offsetHeight}px`
    }

    node.dataset.orb = mode
    place()
    modeRef.current = mode

    if (from && motionAllowed && typeof node.animate === 'function') {
      const to = node.getBoundingClientRect()
      if (to.width > 0 && to.height > 0) {
        node.animate(
          [
            {
              transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
            },
            { transform: 'none' },
          ],
          { duration: GLIDE_MS, easing: GLIDE_EASE },
        )
      }
    }

    if (!slot) return
    // Content above the slot (a finished read, fonts, a resized window) can
    // move it without resizing it; each of these reflows the page.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(slot)
    observer?.observe(document.body)
    window.addEventListener('resize', place)
    let live = true
    void document.fonts?.ready.then(() => { if (live) place() })
    return () => {
      live = false
      observer?.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [slot, motionAllowed])

  if (!host) return null
  const live = host.cognition ?? RESTING
  return (
    <div
      ref={nodeRef}
      className="sd sd-orb-host"
      data-cognition={live.cognition}
      data-provenance={live.provenance}
      data-recording={live.recording ? 'true' : undefined}
    >
      <CognitionField />
    </div>
  )
}

/** Placeholder in the Strategic Delta stage. Without a provider the field
 *  stays inline, so an isolated render still has one orb. */
export function OrbSlot() {
  const host = useContext(OrbHostContext)
  const publish = host?.setSlot
  const ref = useCallback((node: HTMLDivElement | null) => {
    publish?.(node)
  }, [publish])
  if (!host) return <CognitionField />
  return <div className="sd-field-slot" ref={ref} />
}

/** Mission publishes the cognition the shell orb is allowed to show.
 *  Leaving mid-read settles the companion instead of freezing it on work
 *  that is no longer on screen. */
export function useOrbCognition(next: OrbCognition) {
  const { cognition, provenance, recording } = next
  const setCognition = useContext(OrbHostContext)?.setCognition
  const latest = useRef(next)

  useEffect(() => {
    const snapshot = { cognition, provenance, recording }
    latest.current = snapshot
    setCognition?.(snapshot)
  }, [setCognition, cognition, provenance, recording])

  useEffect(() => {
    const publish = setCognition
    return () => {
      const current = latest.current
      const pending = current.recording
        || current.cognition === 'reconstructing'
        || current.cognition === 'deriving'
        || current.cognition === 'correcting'
      publish?.(pending
        ? {
            cognition: current.provenance === 'insufficient_context' ? 'insufficient' : 'settled',
            provenance: current.provenance,
            recording: false,
          }
        : current)
    }
  }, [setCognition])
}

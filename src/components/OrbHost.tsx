'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import CognitionField from '@/components/CognitionField'
import CodexOrb from '@/components/CodexOrb'
import { orbPresentation } from '@/lib/orbPresentation'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'

export type OrbCognition = {
  cognition: string
  provenance: string
  recording: boolean
  resumable?: boolean
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
  interaction: 'ambient' | 'engaged' | 'listening'
  setInteraction: (next: 'ambient' | 'engaged' | 'listening') => void
}

const OrbHostContext = createContext<OrbHostValue | null>(null)

const RESTING: OrbCognition = {
  cognition: 'insufficient',
  provenance: 'insufficient_context',
  recording: false,
  resumable: false,
}

function isComposerElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    const type = target.type || 'text'
    return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit'
  }
  return Boolean(
    target.closest('.mission-invite, .mission-assistance, .commitment-panel, .route-composer, .sd-why'),
  )
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
  const [interaction, setInteraction] = useState<OrbHostValue['interaction']>('ambient')

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      if (!isComposerElement(event.target)) return
      setInteraction(current => (current === 'listening' ? current : 'engaged'))
    }
    function onFocusOut(event: FocusEvent) {
      if (!isComposerElement(event.target)) return
      window.requestAnimationFrame(() => {
        if (!isComposerElement(document.activeElement)) {
          setInteraction(current => (current === 'listening' ? current : 'ambient'))
        }
      })
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  const value = useMemo(
    () => ({ placed, slot, setSlot, cognition, setCognition, interaction, setInteraction }),
    [placed, slot, cognition, interaction],
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
  const presentation = orbPresentation({ ...live, interaction: host.interaction })
  return (
    <div
      ref={nodeRef}
      className="sd sd-orb-host"
      data-orb-state={presentation.state}
      data-cognition={live.cognition}
      data-provenance={live.provenance}
      data-recording={live.recording ? 'true' : undefined}
      data-resumable={live.resumable ? 'true' : undefined}
      data-interaction={host.interaction}
    >
      <CognitionField />
      <CodexOrb state={presentation.state} />
      <span className="orb-status" role="status" aria-live="polite" aria-atomic="true">{presentation.label}</span>
    </div>
  )
}

/** What the one orb is showing right now, for a visible label beside it.
 *  Same source as the host's live status, so the two can never disagree. */
export function useOrbPresentation() {
  const host = useContext(OrbHostContext)
  const live = host?.cognition ?? RESTING
  return orbPresentation({ ...live, interaction: host?.interaction ?? 'ambient' })
}

/** Composer presence is separate from cognition: listening is not reasoning. */
export function useOrbInteraction(interaction: OrbHostValue['interaction']) {
  const publish = useContext(OrbHostContext)?.setInteraction
  useEffect(() => { publish?.(interaction) }, [publish, interaction])
  useEffect(() => () => { publish?.('ambient') }, [publish])
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
  const { cognition, provenance, recording, resumable } = next
  const setCognition = useContext(OrbHostContext)?.setCognition
  const latest = useRef(next)

  useEffect(() => {
    const snapshot = { cognition, provenance, recording, resumable }
    latest.current = snapshot
    setCognition?.(snapshot)
  }, [setCognition, cognition, provenance, recording, resumable])

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
            resumable: current.resumable,
          }
        : current)
    }
  }, [setCognition])
}

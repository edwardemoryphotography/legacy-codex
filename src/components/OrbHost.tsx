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
  operation?: string | null
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

/** Layout offset of `el` inside `ancestor`'s padding box, subtracting any
 *  intermediate scroll container offsets so an inner scroller (Home's
 *  `.glass-hero`) carries the slot accurately instead of freezing the orb
 *  over scrolling recommendation text. Falls back to rects when `ancestor`
 *  is not on the offsetParent chain. */
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
  if (current === ancestor && ancestor) {
    // Subtract inner scroll offsets between el and ancestor. offsetTop ignores
    // scrollTop on intermediate overflow-y: auto containers (e.g. .glass-hero).
    let scrollEl = el.parentElement
    while (scrollEl && scrollEl !== ancestor) {
      left -= scrollEl.scrollLeft
      top -= scrollEl.scrollTop
      scrollEl = scrollEl.parentElement
    }
    return { left, top }
  }
  const a = ancestor?.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return { left: r.left - (a?.left ?? 0), top: r.top - (a?.top ?? 0) }
}

const CLIPPING_OVERFLOW = new Set(['auto', 'scroll', 'hidden', 'clip'])

interface SlotScrollPlacement {
  dockForScroll: boolean
  clipPath: string | null
}

/** Checks every clipping/scrolling ancestor between `slot` and `hostAncestor`.
 *  - When `slot` lives inside an inner scrollable region (like Home's
 *    `.glass-hero`) and has scrolled toward or past the top edge, we promote
 *    the orb into its non-obstructive compact header dock instead of letting
 *    it paint over recommendation text or the top bar.
 *  - Otherwise, if a clipping ancestor partially intersects the slot, return
 *    an exact CSS `clip-path: inset(...)` so the orb can never bleed past its
 *    reserved visual region. */
function inspectScrollClip(
  slot: HTMLElement,
  hostAncestor: Element | null,
  slotLeft: number,
  slotTop: number,
  slotWidth: number,
  slotHeight: number,
): SlotScrollPlacement {
  let clipTop = 0
  let clipRight = 0
  let clipBottom = 0
  let clipLeft = 0
  let hasClip = false
  let dockForScroll = false

  let parent = slot.parentElement
  while (parent && parent !== hostAncestor) {
    const style = window.getComputedStyle(parent)
    const clipsY = CLIPPING_OVERFLOW.has(style.overflowY)
    const clipsX = CLIPPING_OVERFLOW.has(style.overflowX)
    if (clipsY || clipsX) {
      const p = offsetWithin(parent, hostAncestor)
      const pTop = p.top + parent.clientTop
      const pLeft = p.left + parent.clientLeft
      const pWidth = parent.clientWidth
      const pHeight = parent.clientHeight

      // Inner vertical scroll container (e.g. Home's .glass-hero): once the
      // user scrolls down enough that the slot enters/crosses the top edge,
      // glide into the compact top-right header dock so content stays clear.
      // Never dock away an active immersive orb (live voice or active request).
      const inImmersiveStage = Boolean(slot.closest('[data-immersive="true"], [data-busy="true"]'))
      if (!inImmersiveStage && clipsY && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
        if (parent.scrollTop > 16 || (pHeight > 0 && slotTop < pTop - 4)) {
          dockForScroll = true
          break
        }
      }

      if (pHeight > 0 && slotHeight > 0 && clipsY) {
        const overTop = Math.max(0, pTop - slotTop)
        const overBottom = Math.max(0, slotTop + slotHeight - (pTop + pHeight))
        if (overTop > 0 || overBottom > 0) {
          clipTop = Math.max(clipTop, overTop)
          clipBottom = Math.max(clipBottom, overBottom)
          hasClip = true
        }
      }
      if (pWidth > 0 && slotWidth > 0 && clipsX) {
        const overLeft = Math.max(0, pLeft - slotLeft)
        const overRight = Math.max(0, slotLeft + slotWidth - (pLeft + pWidth))
        if (overLeft > 0 || overRight > 0) {
          clipLeft = Math.max(clipLeft, overLeft)
          clipRight = Math.max(clipRight, overRight)
          hasClip = true
        }
      }
    }
    parent = parent.parentElement
  }

  return {
    dockForScroll,
    clipPath: hasClip ? `inset(${Math.round(clipTop)}px ${Math.round(clipRight)}px ${Math.round(clipBottom)}px ${Math.round(clipLeft)}px)` : null,
  }
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
  const placeRef = useRef<((animateTransition?: boolean) => void) | null>(null)
  const motionAllowed = useMotionAllowed()
  const slot = host?.placed ? host.slot : null
  const live = host?.cognition ?? RESTING
  const interaction = host?.interaction ?? 'ambient'

  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const mode = slot ? 'hero' : 'dock'
    const previous = modeRef.current
    const from = previous && previous !== mode ? node.getBoundingClientRect() : null

    function applyDock() {
      if (!node) return
      node.dataset.orb = 'dock'
      node.style.removeProperty('left')
      node.style.removeProperty('top')
      node.style.removeProperty('width')
      node.style.removeProperty('height')
      node.style.removeProperty('clip-path')
    }

    function place(animateTransition = false) {
      if (!node) return
      if (!slot) {
        applyDock()
        return
      }
      // A slot inside a collapsed/hidden subtree (composer expansion, empty
      // reply state) must not keep the orb frozen at its last position over the
      // copy. Walk computed styles so this is testable without layout.
      let painted = true
      for (let ancestor: HTMLElement | null = slot; ancestor; ancestor = ancestor.parentElement) {
        const style = window.getComputedStyle(ancestor)
        if (style.display === 'none' || style.visibility === 'hidden') { painted = false; break }
      }
      if (!painted) {
        node.dataset.orb = 'hidden'
        node.style.removeProperty('clip-path')
        return
      }
      const prevOrb = node.dataset.orb
      const at = offsetWithin(slot, node.offsetParent)
      const w = slot.offsetWidth
      const h = slot.offsetHeight
      const { dockForScroll, clipPath } = inspectScrollClip(slot, node.offsetParent, at.left, at.top, w, h)

      if (dockForScroll) {
        const startRect = animateTransition && prevOrb === 'hero' ? node.getBoundingClientRect() : null
        applyDock()
        if (startRect && motionAllowed && typeof node.animate === 'function') {
          const endRect = node.getBoundingClientRect()
          if (endRect.width > 0 && endRect.height > 0 && startRect.width > 0 && startRect.height > 0) {
            node.animate(
              [
                { transform: `translate(${startRect.left - endRect.left}px, ${startRect.top - endRect.top}px) scale(${startRect.width / endRect.width}, ${startRect.height / endRect.height})` },
                { transform: 'none' },
              ],
              { duration: 320, easing: GLIDE_EASE },
            )
          }
        }
        return
      }

      const startRect = animateTransition && prevOrb === 'dock' ? node.getBoundingClientRect() : null
      node.dataset.orb = 'hero'
      node.style.left = `${at.left}px`
      node.style.top = `${at.top}px`
      node.style.width = `${w}px`
      node.style.height = `${h}px`
      if (clipPath) node.style.clipPath = clipPath
      else node.style.removeProperty('clip-path')

      if (startRect && motionAllowed && typeof node.animate === 'function') {
        const endRect = node.getBoundingClientRect()
        if (endRect.width > 0 && endRect.height > 0 && startRect.width > 0 && startRect.height > 0) {
          node.animate(
            [
              { transform: `translate(${startRect.left - endRect.left}px, ${startRect.top - endRect.top}px) scale(${startRect.width / endRect.width}, ${startRect.height / endRect.height})` },
              { transform: 'none' },
            ],
            { duration: 320, easing: GLIDE_EASE },
          )
        }
      }
    }

    placeRef.current = place
    node.dataset.orb = mode
    place(false)
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
    const reflow = () => place(false)
    // Content above the slot (a finished read, fonts, a resized window) can
    // move it without resizing it; each of these reflows the page.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reflow)
    observer?.observe(slot)
    observer?.observe(document.body)
    // A response/keyboard can move the slot without resizing the slot itself.
    let ancestor = slot.parentElement
    while (ancestor && ancestor !== node.offsetParent) {
      observer?.observe(ancestor)
      ancestor = ancestor.parentElement
    }
    window.addEventListener('resize', reflow)
    // An inner scroll container moves the slot without resizing it (Home's
    // recommendation text is the real case). Track scroll offsets on rAF and
    // dock cleanly into the top bar when content scrolls past the orb.
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        place(true)
      })
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    let live = true
    void document.fonts?.ready.then(() => { if (live) place(false) })
    return () => {
      live = false
      placeRef.current = null
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll, { capture: true })
      observer?.disconnect()
      window.removeEventListener('resize', reflow)
    }
  }, [slot, motionAllowed])

  // Re-measure immediately whenever cognition/operation/interaction changes
  // (e.g. entering active processing from an expanded composer where the slot
  // just transitioned from display:none to visible).
  useLayoutEffect(() => {
    placeRef.current?.(false)
    const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(() => placeRef.current?.(false))
      : 0
    return () => { if (raf) window.cancelAnimationFrame(raf) }
  }, [live.cognition, live.operation, live.recording, interaction])

  if (!host) return null
  const presentation = orbPresentation({ ...live, interaction })
  return (
    <div
      ref={nodeRef}
      className="sd sd-orb-host"
      data-orb-state={presentation.state}
      data-cognition={live.cognition}
      data-provenance={live.provenance}
      data-recording={live.recording ? 'true' : undefined}
      data-resumable={live.resumable ? 'true' : undefined}
      data-interaction={interaction}
    >
      <CognitionField />
      <CodexOrb state={presentation.state} cognition={live.cognition} />
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
  const { cognition, provenance, recording, resumable, operation } = next
  const setCognition = useContext(OrbHostContext)?.setCognition
  const latest = useRef(next)

  useEffect(() => {
    const snapshot = { cognition, provenance, recording, resumable, operation }
    latest.current = snapshot
    setCognition?.(snapshot)
  }, [setCognition, cognition, provenance, recording, resumable, operation])

  useEffect(() => {
    const publish = setCognition
    return () => {
      const current = latest.current
      const pending = Boolean(current.operation) || current.recording
        || current.cognition === 'reconstructing'
        || current.cognition === 'deriving'
        || current.cognition === 'correcting'
      publish?.(pending
        ? {
            cognition: current.provenance === 'insufficient_context' ? 'insufficient' : 'settled',
            provenance: current.provenance,
            recording: false,
            operation: null,
            resumable: current.resumable,
          }
        : current)
    }
  }, [setCognition])
}

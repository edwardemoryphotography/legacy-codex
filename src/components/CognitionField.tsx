'use client'

import { useEffect, useRef } from 'react'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'
import {
  FIELD_WORK_EVENT,
  markNavigation,
  navigationAge,
  presenceForDomEvent,
  type FieldWorkPhase,
} from '@/lib/cognitionPresence'

const TYPING_MS = 800
const ACTIVITY_MS = 1000
const SETTLE_MS = 900
const NAV_REMEMBER_MS = 1200

/**
 * One cognition field. Colour and pending-work state come from the
 * ancestor `.sd[data-cognition]` / `[data-provenance]` / `[data-recording]`
 * selectors. This component only reports pointer presence and real user
 * activity, written onto the field node — never React state — so typing,
 * navigating, or a save cannot re-render the tree on every event.
 *
 * Pointer position and tap location are CSS custom properties, throttled
 * to one write per animation frame. Touch never drives proximity; a tap of
 * any pointer type fires one ripple. Nothing here calls preventDefault.
 *
 * Idle motion is CSS. Activity (`data-presence`) and genuine in-flight
 * work only change which motion the stylesheet is allowed to play.
 */
export default function CognitionField() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const motionAllowed = useMotionAllowed()

  useEffect(() => {
    const node = fieldRef.current
    if (!node) return

    let decay = 0
    let work = 0

    function paintPresence(value: string) {
      node?.setAttribute('data-presence', value)
    }

    function hold(value: 'typing' | 'navigating' | 'mission', ms: number) {
      if (work > 0) return
      paintPresence(value)
      window.clearTimeout(decay)
      decay = window.setTimeout(() => {
        if (work === 0) paintPresence('ambient')
      }, ms)
    }

    const age = navigationAge()
    if (age !== null && age < NAV_REMEMBER_MS) hold('navigating', NAV_REMEMBER_MS - age)

    function onActivity(event: Event) {
      const activity = presenceForDomEvent(event)
      if (!activity || work > 0) return
      if (activity === 'navigating') markNavigation()
      hold(activity, activity === 'typing' ? TYPING_MS : ACTIVITY_MS)
    }

    function onWork(event: Event) {
      const phase = (event as CustomEvent<{ phase?: FieldWorkPhase }>).detail?.phase
      if (phase === 'start') {
        work += 1
        window.clearTimeout(decay)
        paintPresence('working')
        return
      }
      if (phase !== 'end') return
      work = Math.max(0, work - 1)
      if (work > 0) return
      paintPresence('settling')
      window.clearTimeout(decay)
      decay = window.setTimeout(() => {
        if (work === 0) paintPresence('ambient')
      }, SETTLE_MS)
    }

    document.addEventListener('input', onActivity)
    document.addEventListener('change', onActivity)
    document.addEventListener('click', onActivity)
    document.addEventListener('keydown', onActivity)
    document.addEventListener(FIELD_WORK_EVENT, onWork)
    return () => {
      document.removeEventListener('input', onActivity)
      document.removeEventListener('change', onActivity)
      document.removeEventListener('click', onActivity)
      document.removeEventListener('keydown', onActivity)
      document.removeEventListener(FIELD_WORK_EVENT, onWork)
      window.clearTimeout(decay)
    }
  }, [])

  useEffect(() => {
    const node = fieldRef.current
    if (!node || !motionAllowed) return

    let frame = 0
    let pending: { x: number; y: number } | null = null

    function paint() {
      frame = 0
      if (!pending || !node) return
      const rect = node.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const nx = (pending.x - rect.left) / rect.width
      const ny = (pending.y - rect.top) / rect.height
      const dx = nx - 0.5
      const dy = ny - 0.5
      // 0 at the field's centre, fading to 0 by the time the pointer is
      // roughly a field-width away — "strongest near the field, decays
      // with distance" without tracking the pointer once it has left.
      const proximity = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 0.85)
      node.style.setProperty('--px', nx.toFixed(3))
      node.style.setProperty('--py', ny.toFixed(3))
      node.style.setProperty('--proximity', proximity.toFixed(3))
    }

    function onPointerMove(event: PointerEvent) {
      // Proximity is a desktop/hover-shaped effect. Touch drags would
      // otherwise fight the scroll gesture with continuous style writes
      // for an effect the user isn't looking at anyway.
      if (event.pointerType === 'touch') return
      pending = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(paint)
    }

    function onPointerLeave() {
      if (!node) return
      // A pointermove can already have queued paint() for the next frame.
      // Without cancelling it here, that frame runs after this reset and
      // repaints the stale pending coordinates — proximity springs back
      // instead of settling to 0, with no further event to correct it.
      pending = null
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      node.style.setProperty('--proximity', '0')
    }

    function onPointerDown(event: PointerEvent) {
      if (!node) return
      const rect = node.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      node.style.setProperty('--tap-x', ((event.clientX - rect.left) / rect.width).toFixed(3))
      node.style.setProperty('--tap-y', ((event.clientY - rect.top) / rect.height).toFixed(3))
      // Restart the one-shot ripple even on a repeat tap in the same spot:
      // removing the class, forcing a reflow, then re-adding it is the
      // standard way to replay a CSS animation without a JS animation lib.
      node.classList.remove('sd-field-tap')
      void node.offsetWidth
      node.classList.add('sd-field-tap')
    }

    node.addEventListener('pointermove', onPointerMove, { passive: true })
    node.addEventListener('pointerleave', onPointerLeave, { passive: true })
    node.addEventListener('pointerdown', onPointerDown, { passive: true })

    return () => {
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerleave', onPointerLeave)
      node.removeEventListener('pointerdown', onPointerDown)
      if (frame) cancelAnimationFrame(frame)
      // If motion becomes disallowed mid-hover (the user toggles reduced
      // motion, or the system preference changes), this effect re-runs and
      // the guard above means no future pointerleave can ever reset these —
      // reset them here instead, so the field doesn't stay visibly shifted
      // and scaled for the rest of the reduced-motion session.
      node.style.removeProperty('--proximity')
      node.style.removeProperty('--px')
      node.style.removeProperty('--py')
      node.classList.remove('sd-field-tap')
    }
  }, [motionAllowed])

  return (
    <div className="sd-field" ref={fieldRef} data-presence="ambient" aria-hidden="true">
      <span className="sd-field-depth" />
      <span className="sd-blob sd-blob-a" />
      <span className="sd-blob sd-blob-b" />
      <span className="sd-blob sd-blob-c" />
      <span className="sd-field-contour sd-field-contour-cyan" />
      <span className="sd-field-contour sd-field-contour-magenta" />
      <span className="sd-field-specks" />
      <span className="sd-field-ring" />
      <span className="sd-field-core" />
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'

/**
 * The ambient cognition field's pointer/touch presence.
 *
 * Purely a rendering + interaction layer — colour and cognition state come
 * entirely from the ancestor `.sd[data-cognition]` selectors already in
 * globals.css. This component never reads delta state; it only reports
 * where the pointer is.
 *
 * Pointer position and tap location are written straight to CSS custom
 * properties on the field's own DOM node, throttled to one write per
 * animation frame — never React state — so hovering or dragging over the
 * field cannot trigger a re-render. Touch never drives the proximity
 * effect (that stays a desktop, hover-shaped interaction); a tap of any
 * pointer type instead fires a single restrained ripple. Nothing here
 * calls preventDefault, so vertical scroll is untouched even mid-gesture
 * over the field.
 */
export default function CognitionField() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const motionAllowed = useMotionAllowed()

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
    <div className="sd-field" ref={fieldRef} aria-hidden="true">
      <span className="sd-field-specks" />
      <span className="sd-field-ring" />
      <span className="sd-field-core" />
    </div>
  )
}

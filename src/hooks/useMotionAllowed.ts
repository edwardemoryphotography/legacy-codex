'use client'

import { useEffect, useState } from 'react'

/** Both system accessibility settings and Codex's calm controls govern effects. */
export function useMotionAllowed() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setAllowed(
      !media.matches &&
      document.documentElement.dataset.reducedMotion !== 'true' &&
      document.visibilityState === 'visible',
    )
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    media.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return allowed
}

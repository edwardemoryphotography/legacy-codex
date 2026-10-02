'use client'

import { useEffect, useState } from 'react'
import { PRODUCTION_HOST, THEME_COLOR, THEME_KEY, type ReviewTheme } from '@/lib/themeReview'

function applyTheme(theme: ReviewTheme) {
  if (theme === 'light' || theme === 'sunset') document.documentElement.dataset.theme = theme
  else delete document.documentElement.dataset.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

/**
 * Review-only theme switch (dark, light, sunset). Dark is the shipped theme; this exists so
 * Eddie can compare the presentations against his real content on a
 * preview before choosing. It renders only when layout.tsx marked the page
 * as a preview/development build (`data-theme-review="on"`), and never on
 * the production host.
 *
 * `?theme=light|dark|sunset` in the URL also selects and remembers a theme, so a
 * preview link can open straight into one of them.
 */
export default function ThemeReview() {
  const [theme, setTheme] = useState<ReviewTheme | null>(null)

  useEffect(() => {
    // Enabled by the server layout only on preview/development builds; the
    // production hostname check is a second guard.
    if (document.documentElement.dataset.themeReview !== 'on') return
    if (window.location.hostname === PRODUCTION_HOST) return
    const attr = document.documentElement.dataset.theme
    const current: ReviewTheme = attr === 'light' || attr === 'sunset' ? attr : 'dark'
    applyTheme(current)
    // Reading the theme the boot script already applied; nothing to derive
    // during render because the server cannot know it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current)
  }, [])

  if (!theme) return null

  function choose(next: ReviewTheme) {
    applyTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* private mode */ }
    setTheme(next)
  }

  return (
    <div className="theme-review" role="group" aria-label="Review theme (preview only)">
      <span>Preview</span>
      {(['dark', 'light', 'sunset'] as const).map(option => (
        <button
          key={option}
          type="button"
          className="interactive-control"
          aria-pressed={theme === option}
          onClick={() => choose(option)}
        >
          {option === 'dark' ? 'Dark' : option === 'light' ? 'Light' : 'Sunset'}
        </button>
      ))}
    </div>
  )
}

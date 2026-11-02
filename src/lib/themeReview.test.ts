// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { THEME_BOOT_SCRIPT, THEME_KEY } from './themeReview'
import { normalizeAppearance } from './appearance'

afterEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); document.documentElement.removeAttribute('data-motion'); document.documentElement.removeAttribute('data-palette') })
it('restores production appearance before paint and matches normalization', () => {
  const saved = { palette: 'forest', mode: 'light', glow: 0, motion: 'reduced' }
  localStorage.setItem(THEME_KEY, JSON.stringify(saved))
  new Function(THEME_BOOT_SCRIPT)()
  expect(document.documentElement.dataset.palette).toBe(normalizeAppearance(saved).palette)
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(document.documentElement.dataset.motion).toBe('reduced')
  expect(document.documentElement.style.getPropertyValue('--ambient-glow')).toBe('0')
})
it('ignores corrupt stored preferences without blocking app startup', () => {
  localStorage.setItem(THEME_KEY, '{')
  expect(() => new Function(THEME_BOOT_SCRIPT)()).not.toThrow()
})

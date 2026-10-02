// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { THEME_BOOT_SCRIPT, THEME_COLOR, THEME_KEY } from './themeReview'

function boot(search: string, stored?: string) {
  window.history.replaceState({}, '', '/' + search)
  if (stored) localStorage.setItem(THEME_KEY, stored)
  // The script is the exact string layout.tsx inlines, so this runs what ships.
  new Function(THEME_BOOT_SCRIPT)()
  return document.documentElement.dataset.theme
}

describe('theme review boot script', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme
    localStorage.clear()
  })

  it('applies sunset from the query string and remembers it', () => {
    expect(boot('?theme=sunset')).toBe('sunset')
    expect(localStorage.getItem(THEME_KEY)).toBe('sunset')
  })

  it('restores a stored sunset or light theme', () => {
    expect(boot('', 'sunset')).toBe('sunset')
    delete document.documentElement.dataset.theme
    expect(boot('', 'light')).toBe('light')
  })

  it('leaves dark as the absence of data-theme and ignores unknown values', () => {
    expect(boot('?theme=dark', 'sunset')).toBeUndefined()
    expect(boot('?theme=nope')).toBeUndefined()
  })

  it('has a browser theme colour for every theme', () => {
    expect(Object.keys(THEME_COLOR).sort()).toEqual(['dark', 'light', 'sunset'])
  })
})

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import ThemeReview from './ThemeReview'
import { APPEARANCE_KEY } from '@/lib/appearance'
afterEach(() => { cleanup(); localStorage.clear() })
it('exposes production preferences and restores the stored selection on remount', () => {
  const { unmount } = render(<ThemeReview />)
  fireEvent.click(screen.getByText('Appearance', { selector: 'summary' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ocean' }))
  fireEvent.click(screen.getByRole('button', { name: 'Light' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Motion' }), { target: { value: 'reduced' } })
  expect(document.documentElement.dataset.palette).toBe('ocean')
  expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toMatchObject({ palette: 'ocean', mode: 'light', motion: 'reduced' })
  unmount()
  render(<ThemeReview />)
  fireEvent.click(screen.getByText('Appearance', { selector: 'summary' }))
  expect(screen.getByRole('button', { name: 'Ocean' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
})

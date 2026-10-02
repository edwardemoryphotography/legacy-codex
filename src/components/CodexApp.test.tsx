import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodexApp from './CodexApp'

vi.mock('./tabs/MissionTab', () => ({ default: () => null }))
vi.mock('./ThemeReview', () => ({ default: () => null }))
vi.mock('./OrbHost', () => ({
  OrbHostProvider: ({ children }: { children: unknown }) => children,
  PersistentOrb: () => null,
}))

afterEach(cleanup)

describe('Origin Atlas is findable from More', () => {
  it('opens Origin Atlas from More without leaving Mission as home', () => {
    render(<CodexApp />)
    expect(screen.getByRole('tab', { name: 'Mission' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Origin Atlas' }))
    expect(screen.getByTitle('Current human-intent loop')).toHaveAttribute(
      'src',
      '/origin/architecture/index.html#lens=frontend~database',
    )
    expect(screen.getByRole('tab', { name: 'Mission' })).toHaveAttribute('aria-selected', 'false')
  })
})

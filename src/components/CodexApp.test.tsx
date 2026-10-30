import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodexApp from './CodexApp'

vi.mock('./tabs/MissionTab', () => ({ default: () => null }))
vi.mock('./tabs/HomeTab', () => ({ default: () => <p>Glass home</p> }))
vi.mock('./ThemeReview', () => ({ default: () => null }))
vi.mock('./OrbHost', () => ({
  OrbHostProvider: ({ children }: { children: unknown }) => children,
  PersistentOrb: () => null,
}))

afterEach(cleanup)

describe('the top-left menu holds every screen', () => {
  it('opens on Home and reaches Origin Atlas through the menu', () => {
    render(<CodexApp />)
    expect(screen.getByText('Glass home')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Origin Atlas' }))
    expect(screen.getByTitle('Current human-intent loop')).toHaveAttribute(
      'src',
      '/origin/architecture/index.html#lens=frontend~database',
    )
    expect(screen.queryByText('Glass home')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
  })

  it('closes the menu with Escape', () => {
    render(<CodexApp />)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
  })
})

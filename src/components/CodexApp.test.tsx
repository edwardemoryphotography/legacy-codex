import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodexApp from './CodexApp'
import { useState } from 'react'

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))

vi.mock('./tabs/MissionTab', () => ({ default: ({ onMissionChange }: { onMissionChange?: () => void }) => <button onClick={onMissionChange}>Commit workspace change</button> }))
vi.mock('./tabs/HomeTab', () => ({ default: function TestConversation({ projectRevision = 0 }: { projectRevision?: number }) { const [pending, setPending] = useState(false); return <><p>Glass home</p><button onClick={() => setPending(true)}>{pending ? 'Answer pending' : 'Start question'}</button><span>Project revision {projectRevision}</span></> } }))
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

it('refreshes project data without discarding an in-flight conversation', () => {
  render(<CodexApp />)
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mission' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start question' }))
  fireEvent.click(screen.getByRole('button', { name: 'Commit workspace change' }))
  expect(screen.getByRole('button', { name: 'Answer pending' })).toBeInTheDocument()
  expect(screen.getByText('Project revision 1')).toBeInTheDocument()
})

it('keeps a pending conversation mounted across Home and Mission navigation', () => {
  render(<CodexApp />)
  fireEvent.click(screen.getByRole('button', { name: 'Start question' }))
  for (const name of ['Mission', 'Home']) {
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByRole('button', { name: 'Answer pending' })).toBeInTheDocument()
  }
})

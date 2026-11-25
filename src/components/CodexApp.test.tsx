import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodexApp from './CodexApp'
import { useState } from 'react'

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))

vi.mock('./tabs/MissionTab', () => ({ default: ({ onMissionChange }: { onMissionChange?: () => void }) => <button onClick={onMissionChange}>Commit workspace change</button> }))
vi.mock('./tabs/HomeTab', () => ({ default: function TestConversation({ projectRevision = 0, onLiveVoiceStateChange }: { projectRevision?: number; onLiveVoiceStateChange?: (state: { active: boolean; phase: string; transportState: string; muted: boolean; micState: string; micLive: boolean; label: string; detail: string; hasProposal: boolean; turnCount: number; retainedExchanges: number; suppliedMessages: number; recoveredExchanges: number; directRecoveryAdvisorySent: boolean }) => void }) { const [pending, setPending] = useState(false); return <><p>Glass home</p><button onClick={() => setPending(true)}>{pending ? 'Answer pending' : 'Start question'}</button><button onClick={() => onLiveVoiceStateChange?.({ active: true, phase: 'listening', transportState: 'connected', muted: false, micState: 'live', micLive: true, label: 'Listening', detail: '', hasProposal: true, turnCount: 1, retainedExchanges: 1, suppliedMessages: 2, recoveredExchanges: 0, directRecoveryAdvisorySent: false })}>Activate live voice</button><span>Project revision {projectRevision}</span></> } }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Continue conversation with Codex' }))
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
    if (name === 'Mission') fireEvent.click(screen.getByRole('button', { name: 'Continue conversation with Codex' }))
    expect(screen.getByRole('button', { name: 'Answer pending' })).toBeInTheDocument()
  }
})

it('keeps an active live voice session mounted across Territory navigation and offers Return to voice', () => {
  const { container } = render(<CodexApp />)
  fireEvent.click(screen.getByRole('button', { name: 'Activate live voice' }))
  expect(container.querySelector('.codex-shell')).toHaveAttribute('data-voice-immersive', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  fireEvent.click(screen.getByRole('button', { name: 'Territory' }))
  // Persistent indicator appears on non-Home screen and HomeTab stays mounted (hidden) so voice is not torn down.
  expect(screen.getByRole('region', { name: 'Active live voice session' })).toBeInTheDocument()
  expect(screen.getByText('Live voice · Listening')).toBeInTheDocument()
  expect(screen.getByText(/Microphone live · Connected · live audio metered while connected · 1 exchange retained · 2 messages supplied to backend/)).toBeInTheDocument()
  expect(screen.getByText('Proposal ready')).toBeInTheDocument()
  expect(document.getElementById('home-conversation')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Return to voice' }))
  expect(screen.queryByRole('region', { name: 'Active live voice session' })).not.toBeInTheDocument()
  expect(screen.getByText('Glass home')).toBeInTheDocument()
})

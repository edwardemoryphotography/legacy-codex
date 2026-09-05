import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), signInAnonymously: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: mocks, from: mocks.from } }))
vi.mock('@/components/ActivityOrb', () => ({ default: () => null }))
vi.mock('@/components/FocusBeam', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))
import MissionTab from './MissionTab'

// Authentication response only; these tests never invent saved missions.
const user = { id: 'existing-session-user' }
const sessionResponse = { data: { session: { user } }, error: null }
const emptyResponse = { data: [], error: null }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getSession.mockResolvedValue(sessionResponse)
  mocks.from.mockImplementation(() => ({ select: () => ({ ...emptyResponse, eq: async () => emptyResponse }) }))
})
afterEach(cleanup)

describe('Mission connection recovery', () => {
  it('retries a session failure without replacing the identity or losing the note', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: new TypeError('Failed to fetch') })
    render(<MissionTab />)
    await screen.findByRole('button', { name: 'Try connection again' })
    expect(mocks.signInAnonymously).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for the handoff' }), { target: { value: 'Keep my context' } })
    fireEvent.click(screen.getByRole('button', { name: 'Try connection again' }))
    await screen.findByText('Connected')
    expect((screen.getByRole('textbox', { name: 'Optional note for the handoff' }) as HTMLTextAreaElement).value).toBe('Keep my context')
    expect(mocks.signInAnonymously).not.toHaveBeenCalled()
  })

  it('recovers a failed mission read and never labels the failed read Connected', async () => {
    mocks.from.mockImplementationOnce(() => ({ select: () => ({ eq: async () => ({ data: null, error: new Error('Unavailable') }) }) }))
    render(<MissionTab />)
    await screen.findByRole('button', { name: 'Try connection again' })
    expect(screen.queryByText('Connected')).toBeNull()
    expect(screen.queryByRole('button', { name: 'New mission' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try connection again' }))
    await screen.findByText('Connected')
    expect(screen.getByRole('button', { name: 'New mission' })).toBeTruthy()
  })

  it('offers recovery when sign-in returns no user instead of loading forever', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.signInAnonymously.mockResolvedValue({ data: { user: null }, error: null })
    render(<MissionTab />)
    await screen.findByRole('button', { name: 'Try connection again' })
    expect(screen.queryByText('Connecting to your missions…')).toBeNull()
  })

  it('shares anonymous sign-in across StrictMode remounts', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.signInAnonymously.mockResolvedValue({ data: { user }, error: null })
    render(<StrictMode><MissionTab /></StrictMode>)
    await screen.findByText('Connected')
    await waitFor(() => expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1))
  })

  it('keeps service error details out of the interface', async () => {
    mocks.getSession.mockRejectedValue({ status: 429, message: 'internal diagnostic with sensitive details' })
    render(<MissionTab />)
    await screen.findByText('The connection service is busy. Wait a moment, then try again.')
    expect(screen.queryByText(/sensitive details/)).toBeNull()
  })
})

import { useState } from 'react'
import '@testing-library/jest-dom/vitest'
import type { User } from '@supabase/supabase-js'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountCard from './AccountCard'

const mock = vi.hoisted(() => ({ getSession: vi.fn(), updateUser: vi.fn(), verifyOtp: vi.fn(), signInWithOtp: vi.fn(), signOut: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: {
  auth: mock,
  from: () => ({ select: () => ({ eq: () => ({ limit: mock.limit }) }) }),
} }))
const anon = { id: 'original-account', is_anonymous: true } as User
const email = 'person@example.com'
const permanent = { ...anon, email, email_confirmed_at: '2026-10-27T00:00:00Z', is_anonymous: false } as User
const converted = vi.fn()

function Account({ initial = anon }: { initial?: User }) {
  const [user, setUser] = useState(initial)
  return <AccountCard user={user} loading={false} connectionError="" onRetry={vi.fn()} onConverted={next => { converted(next); setUser(next) }} />
}

beforeEach(() => {
  vi.resetAllMocks()
  mock.getSession.mockResolvedValue({ data: { session: { user: anon } }, error: null })
  mock.updateUser.mockResolvedValue({ data: { user: anon }, error: null })
  mock.verifyOtp.mockResolvedValue({ data: { user: permanent }, error: null })
  mock.signInWithOtp.mockResolvedValue({ error: null })
  mock.limit.mockResolvedValue({ data: [], error: null })
})

async function sendCode() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
  await screen.findByLabelText('6-digit code')
}

describe('Account card with a mocked Supabase client', () => {
  it('hides Sign out for anonymous users and converts in place', async () => {
    render(<Account />)
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    await sendCode()
    expect(mock.updateUser).toHaveBeenCalledWith({ email })
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText(`Signed in as ${email} — works in any browser`)).toBeTruthy()
    expect(mock.verifyOtp).toHaveBeenCalledWith({ email, token: '123456', type: 'email_change' })
    expect(converted).toHaveBeenCalledWith(expect.objectContaining({ id: anon.id, is_anonymous: false }))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('warns before sign-in with saved missions and requires explicit acknowledgement', async () => {
    mock.limit.mockResolvedValue({ data: [{ id: 'saved-mission' }], error: null })
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: /Already have an account/ }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByText(/Those missions stay on the other account/)).toBeTruthy()
    expect(mock.signInWithOtp).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    await screen.findByLabelText('6-digit code')
    expect(mock.signInWithOtp).toHaveBeenCalledWith({ email, options: { shouldCreateUser: false } })
  })

  it('keeps the code form for a wrong code, allowing retry', async () => {
    mock.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired' } })
    render(<Account />)
    await sendCode()
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '111111' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('wrong or has expired')
    expect(screen.getByLabelText('6-digit code')).toBeTruthy()
    expect(converted).not.toHaveBeenCalled()
  })

  it.each([
    [{ code: 'email_exists' }, /belongs to another account/],
    [{ code: 'over_email_send_rate_limit', status: 429 }, /Too many codes/],
  ])('shows send errors without proceeding to confirmation: %j', async (failure, expected) => {
    mock.updateUser.mockResolvedValue({ data: { user: null }, error: failure })
    render(<Account />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
    expect(screen.queryByLabelText('6-digit code')).toBeNull()
  })

  it('displays a retryable connection failure without offering anonymous sign-out', () => {
    const retry = vi.fn()
    render(<AccountCard user={null} loading={false} connectionError="Saved session unavailable" onRetry={retry} onConverted={converted} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry account connection' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })

  it('can resend or correct an email after sending', async () => {
    render(<Account />)
    await sendCode()
    fireEvent.click(screen.getByRole('button', { name: 'Send new code' }))
    await waitFor(() => expect(mock.updateUser).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change email' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
    expect(screen.queryByLabelText('6-digit code')).toBeNull()
    expect(screen.getByLabelText('Email')).not.toBeDisabled()
  })

  it('does not offer sign-out for an unconfirmed email', () => {
    render(<Account initial={{ ...permanent, email_confirmed_at: undefined }} />)
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })
})

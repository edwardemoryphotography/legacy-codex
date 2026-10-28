import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSwitchWarning, confirmConversion, confirmEmailSignIn, emailAccountMessage, sendConversionCode, sendSignInCode, signOutEmailAccount } from './emailAccount'
import { connectMissionSession } from './missionSession'
import { captureInboxKey, preserveLegacyCaptureInbox, readCaptureInbox } from '../captureCache'

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), updateUser: vi.fn(), verifyOtp: vi.fn(), signInWithOtp: vi.fn(), signOut: vi.fn(), signInAnonymously: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), limit: vi.fn(),
}))
vi.mock('./client', () => ({ supabase: { auth: mock, from: mock.from } }))

const anon = { id: 'original-account', is_anonymous: true } as User
const email = 'person@example.com'
const permanent = { ...anon, is_anonymous: false, email, email_confirmed_at: '2026-10-27T00:00:00Z' } as User

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  mock.getSession.mockResolvedValue({ data: { session: { user: anon } }, error: null })
  mock.updateUser.mockResolvedValue({ data: { user: anon }, error: null })
  mock.verifyOtp.mockResolvedValue({ data: { user: permanent }, error: null })
  mock.signInWithOtp.mockResolvedValue({ error: null })
  mock.signOut.mockResolvedValue({ error: null })
  mock.from.mockReturnValue({ select: mock.select })
  mock.select.mockReturnValue({ eq: mock.eq })
  mock.eq.mockReturnValue({ limit: mock.limit })
  mock.limit.mockResolvedValue({ data: [], error: null })
})

describe('email accounts without changing ownership', () => {
  it('converts the original anonymous user with email_change, preserving the id', async () => {
    await sendConversionCode(email, anon.id)
    expect(mock.updateUser).toHaveBeenCalledWith({ email })
    const result = await confirmConversion(email, '123456', anon.id)
    expect(mock.verifyOtp).toHaveBeenCalledWith({ email, token: '123456', type: 'email_change' })
    expect(mock.updateUser.mock.invocationCallOrder[0]).toBeLessThan(mock.verifyOtp.mock.invocationCallOrder[0])
    expect(result.id).toBe(anon.id)
    expect(result.is_anonymous).toBe(false)
    expect(mock.signInWithOtp).not.toHaveBeenCalled()
    expect(mock.signInAnonymously).not.toHaveBeenCalled()
  })

  it('does not accept a converted user with a different id', async () => {
    mock.verifyOtp.mockResolvedValue({ data: { user: { ...permanent, id: 'different' } }, error: null })
    await expect(confirmConversion(email, '123456', anon.id)).rejects.toThrow('original account')
  })

  it('does not claim conversion before email confirmation', async () => {
    mock.verifyOtp.mockResolvedValue({ data: { user: anon }, error: null })
    await expect(confirmConversion(email, '123456', anon.id)).rejects.toThrow('not confirmed')
  })

  it('signs in elsewhere without creating an account, using email OTP', async () => {
    await sendSignInCode(email, anon.id, false)
    await confirmEmailSignIn(email, '123456', anon.id, false)
    expect(mock.signInWithOtp).toHaveBeenCalledWith({ email, options: { shouldCreateUser: false } })
    expect(mock.verifyOtp).toHaveBeenCalledWith({ email, token: '123456', type: 'email' })
    expect(mock.updateUser).not.toHaveBeenCalled()
  })

  it('also allows email sign-in when no session exists', async () => {
    mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await sendSignInCode(email, null, false)
    expect(mock.signInWithOtp).toHaveBeenCalledOnce()
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('requires acknowledgement for missions and never moves their rows', async () => {
    mock.limit.mockResolvedValue({ data: [{ id: 'saved-mission' }], error: null })
    await expect(sendSignInCode(email, anon.id, false)).rejects.toBeInstanceOf(AccountSwitchWarning)
    expect(mock.signInWithOtp).not.toHaveBeenCalled()
    await sendSignInCode(email, anon.id, true)
    await confirmEmailSignIn(email, '123456', anon.id, true)
    expect(mock.from).toHaveBeenCalledWith('missions')
    expect(mock.eq).toHaveBeenCalledWith('user_id', anon.id)
    expect(mock.select).toHaveBeenCalledWith('id')
  })

  it('rechecks for missions created between sending and confirming', async () => {
    await sendSignInCode(email, anon.id, false)
    mock.limit.mockResolvedValue({ data: [{ id: 'new-mission' }], error: null })
    await expect(confirmEmailSignIn(email, '123456', anon.id, false)).rejects.toBeInstanceOf(AccountSwitchWarning)
    expect(mock.verifyOtp).not.toHaveBeenCalled()
  })

  it('blocks replacement when mission reads fail, even with acknowledgement', async () => {
    mock.limit.mockResolvedValue({ data: null, error: new Error('offline') })
    await expect(confirmEmailSignIn(email, '123456', anon.id, true)).rejects.toThrow('Could not check')
    expect(mock.verifyOtp).not.toHaveBeenCalled()
  })

  it('never creates an anonymous replacement after a failed session read', async () => {
    const failure = new Error('session read failed')
    mock.getSession.mockResolvedValue({ data: { session: null }, error: failure })
    await expect(connectMissionSession()).rejects.toBe(failure)
    await expect(sendConversionCode(email, anon.id)).rejects.toBe(failure)
    await expect(sendSignInCode(email, anon.id, true)).rejects.toBe(failure)
    expect(mock.signInAnonymously).not.toHaveBeenCalled()
    expect(mock.updateUser).not.toHaveBeenCalled()
    expect(mock.signInWithOtp).not.toHaveBeenCalled()
  })

  it('refuses stale actions after another tab changes accounts', async () => {
    mock.getSession.mockResolvedValue({ data: { session: { user: { ...anon, id: 'other' } } }, error: null })
    await expect(sendConversionCode(email, anon.id)).rejects.toThrow('another tab')
    await expect(confirmEmailSignIn(email, '123456', anon.id, true)).rejects.toThrow('another tab')
    expect(mock.verifyOtp).not.toHaveBeenCalled()
  })

  it('refuses anonymous sign-out, then signs out only this browser for email accounts', async () => {
    await expect(signOutEmailAccount(anon.id)).rejects.toThrow('Add and confirm')
    expect(mock.signOut).not.toHaveBeenCalled()
    mock.getSession.mockResolvedValue({ data: { session: { user: permanent } }, error: null })
    await signOutEmailAccount(permanent.id)
    expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('preserves the legacy capture cache under the source id before signing out', async () => {
    const capture = { id: 'old-capture', text: 'Private capture', timestamp: '2026-10-27' }
    localStorage.setItem('nd_inbox_v1', JSON.stringify([capture]))
    mock.getSession.mockResolvedValue({ data: { session: { user: permanent } }, error: null })
    await signOutEmailAccount(permanent.id)
    expect(readCaptureInbox(permanent.id)).toEqual([capture])
    expect(localStorage.getItem('nd_inbox_v1')).toBeNull()
    expect(localStorage.getItem(captureInboxKey(permanent.id))).toContain('Private capture')
  })

  it('quarantines unowned legacy captures before signing in without a session', async () => {
    localStorage.setItem('nd_inbox_v1', JSON.stringify([{ id: 'unknown', text: 'Unowned capture' }]))
    mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await sendSignInCode(email, null, false)
    expect(localStorage.getItem('nd_inbox_v1')).toBeNull()
    expect(localStorage.getItem('nd_inbox_v2:unclaimed:legacy')).toContain('Unowned capture')
    expect(readCaptureInbox(permanent.id)).toEqual([])
  })

  it('blocks an account switch if the original capture cache cannot be preserved', async () => {
    localStorage.setItem('nd_inbox_v1', 'malformed but preserved')
    await expect(sendSignInCode(email, anon.id, true)).rejects.toThrow('Could not preserve')
    expect(mock.signInWithOtp).not.toHaveBeenCalled()
    expect(localStorage.getItem('nd_inbox_v1')).toBe('malformed but preserved')
  })

  it('keeps late writes from an older tab bound to the original source account', () => {
    preserveLegacyCaptureInbox(anon.id)
    localStorage.setItem('nd_inbox_v1', JSON.stringify([{ id: 'late', text: 'Older tab capture' }]))
    preserveLegacyCaptureInbox('destination-account')
    expect(readCaptureInbox(anon.id)[0].text).toBe('Older tab capture')
    expect(readCaptureInbox('destination-account')).toEqual([])
  })

  it.each(['updateUser', 'verifyOtp', 'signInWithOtp', 'signOut'] as const)('does not swallow %s failures', async method => {
    const failure = { code: 'over_email_send_rate_limit', status: 429 }
    mock[method].mockResolvedValue({ data: { user: null }, error: failure })
    if (method === 'signOut') mock.getSession.mockResolvedValue({ data: { session: { user: permanent } }, error: null })
    const action = method === 'updateUser' ? sendConversionCode(email, anon.id)
      : method === 'verifyOtp' ? confirmConversion(email, '123456', anon.id)
        : method === 'signInWithOtp' ? sendSignInCode(email, anon.id, false) : signOutEmailAccount(permanent.id)
    await expect(action).rejects.toBe(failure)
  })
})

describe('plain-language account errors', () => {
  it.each([
    [{ code: 'otp_expired' }, /wrong or has expired/],
    [{ status: 429 }, /Too many codes/],
    [{ code: 'over_email_send_rate_limit' }, /Too many codes/],
    [{ code: 'email_exists' }, /belongs to another account/],
    [{ code: 'user_already_exists' }, /belongs to another account/],
    [{ code: 'signup_disabled' }, /No email account was found/],
    [{ code: 'email_address_not_authorized' }, /Email delivery is not available/],
    [new Error('private provider details'), /Could not reach/],
  ])('maps %j safely', (failure, expected) => expect(emailAccountMessage(failure)).toMatch(expected))
})

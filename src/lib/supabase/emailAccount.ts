import type { User } from '@supabase/supabase-js'
import { supabase } from './client'

export class AccountSwitchWarning extends Error {
  constructor() {
    super('This browser has saved missions on its anonymous account. Signing in replaces this browser’s access to that account. Those missions stay on the other account and will not move to your email account. Add an email to this account first if you want to keep access to them.')
  }
}

// Read only: account actions must never mint an anonymous identity to recover
// from a failed read, or act on a different account after another tab changes it.
async function currentAccount(expectedId: string | null): Promise<User | null> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  const user = session?.user ?? null
  if ((user?.id ?? null) !== expectedId) {
    throw new Error('Your account changed in another tab. Reload this page before continuing.')
  }
  return user
}

export function isEmailAccount(user: User | null): boolean {
  return user?.is_anonymous === false && !!user.email && !!user.email_confirmed_at
}

export async function sendConversionCode(email: string, expectedId: string): Promise<void> {
  const user = await currentAccount(expectedId)
  if (!user?.is_anonymous) throw new Error('Reload this page to check your account before adding an email.')
  const { data, error } = await supabase.auth.updateUser({ email })
  if (error) throw error
  if (data.user?.id !== expectedId) throw new Error('Could not confirm the original account. Keep this browser’s saved data and reload.')
}

export async function confirmConversion(email: string, token: string, expectedId: string): Promise<User> {
  await currentAccount(expectedId)
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' })
  if (error) throw error
  if (data.user?.id !== expectedId) throw new Error('Could not confirm the original account. Keep this browser’s saved data and reload.')
  if (!isEmailAccount(data.user)) throw new Error('Your email is not confirmed yet. Keep this browser open and enter the latest code.')
  return data.user
}

async function checkAccountSwitch(expectedId: string | null, acknowledged: boolean): Promise<void> {
  const user = await currentAccount(expectedId)
  if (!user) return
  if (!user.is_anonymous) throw new Error('You are already signed in. Reload this page to check your account.')
  const { data, error } = await supabase.from('missions').select('id').eq('user_id', user.id).limit(1)
  // An unavailable mission read is not an empty account. Never replace it blindly.
  if (error || !data) throw new Error('Could not check this browser’s saved missions. Try again before switching accounts.')
  if (data.length && !acknowledged) throw new AccountSwitchWarning()
}

export async function sendSignInCode(email: string, expectedId: string | null, acknowledged: boolean): Promise<void> {
  await checkAccountSwitch(expectedId, acknowledged)
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (error) throw error
}

export async function confirmEmailSignIn(email: string, token: string, expectedId: string | null, acknowledged: boolean): Promise<User> {
  // Recheck at replacement time: missions may have been saved since Send code.
  await checkAccountSwitch(expectedId, acknowledged)
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  if (!isEmailAccount(data.user)) throw new Error('Email sign-in was not confirmed. Enter the latest code and try again.')
  return data.user!
}

export async function signOutEmailAccount(expectedId: string): Promise<void> {
  const user = await currentAccount(expectedId)
  if (!isEmailAccount(user)) throw new Error('Add and confirm an email before signing out so you can get this account back.')
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export function emailAccountMessage(error: unknown): string {
  const detail = error && typeof error === 'object' ? error as { code?: string; status?: number; message?: string } : {}
  if (detail.status === 429 || /rate_limit|over_email_send/.test(detail.code ?? '')) {
    return 'Too many codes requested. Wait a few minutes before trying again; the email service may have an hourly limit.'
  }
  if (detail.code === 'otp_expired' || /token.*(expired|invalid)|otp.*(expired|invalid)/i.test(detail.message ?? '')) {
    return 'That code is wrong or has expired. Try the latest 6-digit code, or send a new one.'
  }
  if (['email_exists', 'user_already_exists', 'identity_already_exists'].includes(detail.code ?? '')) {
    return 'That email belongs to another account. Use a different email to keep this account, or choose Sign in with email. Your missions will not move between accounts.'
  }
  if (detail.code === 'email_address_invalid') return 'Enter a valid email address and try again.'
  if (['email_provider_disabled', 'otp_disabled', 'email_address_not_authorized'].includes(detail.code ?? '')) {
    return 'Email delivery is not available for this address yet. Eddie needs to check the Supabase email settings.'
  }
  if (detail.code === 'signup_disabled') return 'No email account was found. In the browser with your missions, add and confirm this email first.'
  // Only expose our own plain-language messages, never raw provider responses.
  if (error instanceof Error && !('status' in error) && !('code' in error)
    && /^(Your account changed|Reload this page|Could not confirm|Your email is not|Could not check|You are already|Email sign-in was not|Add and confirm)/.test(error.message)) return error.message
  return 'Could not reach the account service. Keep this browser’s saved data and try again.'
}

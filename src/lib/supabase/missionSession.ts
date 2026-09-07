import type { User } from '@supabase/supabase-js'
import { supabase } from './client'

let pending: Promise<User> | null = null

// Reuse an in-flight connection across remounts. A failed session read must
// never silently create a replacement anonymous identity.
export function connectMissionSession(): Promise<User> {
  if (pending) return pending
  pending = (async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    if (session?.user) return session.user
    const { data, error: signInError } = await supabase.auth.signInAnonymously()
    if (signInError) throw signInError
    if (!data.user) throw new Error('No session returned')
    return data.user
  })().finally(() => { pending = null })
  return pending
}

export function missionConnectionMessage(error: unknown): string {
  const detail = error && typeof error === 'object' ? error as { code?: string; status?: number; message?: string } : {}
  if (detail.status === 429 || detail.code === 'over_request_rate_limit') {
    return 'The connection service is busy. Wait a moment, then try again.'
  }
  if (detail.code === 'anonymous_provider_disabled' || detail.status === 401 || detail.status === 403
    || /not configured|invalid api key/i.test(detail.message ?? '')) {
    return 'This version could not open a session. Use the main Legacy Codex site, then try again.'
  }
  if (detail.code === 'refresh_token_not_found' || detail.code === 'refresh_token_already_used') {
    return 'Your saved session could not be renewed. Keep this browser’s saved data and retry; do not clear it.'
  }
  return 'The connection was interrupted. Try again to reconnect to your saved session.'
}

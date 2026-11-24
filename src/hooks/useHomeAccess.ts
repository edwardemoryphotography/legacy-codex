'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession } from '@/lib/supabase/missionSession'

export type HomeAccessState = 'checking' | 'owner' | 'signed-out' | 'no-access' | 'unconfigured' | 'error'

export interface HomeAccess {
  state: HomeAccessState
  configured: boolean
  name: string
  /** True for a confirmed email account; false or absent for an anonymous guest. */
  tester?: boolean
  signedIn?: boolean
}

/** Resolve the existing owner gate before the UI presents AI as ready. */
export function useHomeAccess(): HomeAccess {
  const [access, setAccess] = useState<HomeAccess>({ state: 'checking', configured: false, name: '' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Resolve the browser session before asking whether this account is
        // the owner. Home may mount before the first mission read signs in.
        const connected = await Promise.race([
          connectMissionSession().then(() => true),
          new Promise<boolean>(resolve => setTimeout(() => resolve(false), 8000)),
        ])
        if (cancelled) return
        if (!connected) { setAccess({ state: 'error', configured: false, name: '' }); return }
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session?.access_token) {
          setAccess({ state: 'signed-out', configured: false, name: '' })
          return
        }
        const signedIn = session.user?.is_anonymous === false && Boolean(session.user?.email)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        let response: Response
        try {
          response = await fetch('/api/delta-review?capabilities=1', {
            headers: { Authorization: 'Bearer ' + session.access_token },
            cache: 'no-store',
            signal: controller.signal,
          })
        } finally { clearTimeout(timeout) }
        if (cancelled) return
        if (response.status === 401) {
          setAccess({ state: 'signed-out', configured: false, name: '' })
          return
        }
        if (response.status === 403) {
          setAccess({ state: 'no-access', configured: false, name: '', signedIn })
          return
        }
        if (!response.ok) {
          setAccess({ state: 'error', configured: false, name: '' })
          return
        }
        const body = await response.json() as { configured?: unknown; tester?: unknown }
        if (cancelled) return
        if (body.tester === true) {
          // Tester grants apply to project review only; they do not open brief
          // or live voice. Do not present those tools as ready.
          setAccess({ state: 'no-access', configured: body.configured === true, name: '', signedIn, tester: true })
          return
        }
        if (body.tester !== false) {
          setAccess({ state: 'error', configured: false, name: '' })
          return
        }
        if (body.configured !== true) {
          setAccess({ state: 'unconfigured', configured: false, name: 'Eddie' })
          return
        }
        setAccess({ state: 'owner', configured: true, name: 'Eddie' })
      } catch {
        if (!cancelled) setAccess({ state: 'error', configured: false, name: '' })
      }
    })()
    return () => { cancelled = true }
  }, [])

  return access
}

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@supabase/server/core'
import { resolveUserAuthEnv } from './userAuthEnv'

// Same owner boundary for generation and project reconstruction. No admin key.
export async function deltaOwner(req: NextRequest): Promise<{ response: NextResponse } | { userId: string; url: string }> {
  const resolved = resolveUserAuthEnv()
  if (!resolved.env) return { response: NextResponse.json({ error: 'Server authentication is misconfigured.' }, { status: 500 }) }
  const { data, error } = await verifyAuth(req, { auth: 'user', env: resolved.env })
  if (error) return { response: NextResponse.json({ error: error.status === 500 ? 'Server authentication is misconfigured.' : 'Sign in to use model-assisted candidates.' }, { status: error.status === 500 ? 500 : 401 }) }
  const userId = data?.userClaims?.id
  const local = process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1', '::1'].includes(req.nextUrl.hostname)
  if (!userId || (!local && userId !== process.env.DELTA_OPERATION_ALLOWED_USER_ID)) {
    return { response: NextResponse.json({ error: 'Model-assisted candidates are not enabled for this account.' }, { status: 403 }) }
  }
  return { userId, url: resolved.env.url }
}

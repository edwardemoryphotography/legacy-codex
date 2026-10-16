import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@supabase/server/core'
import { resolveUserAuthEnv } from './userAuthEnv'
import { projectUserClient } from '@/lib/projectReviewServer'

// Same owner boundary for generation and project reconstruction. No admin key.
async function deltaUser(req: NextRequest): Promise<{ response: NextResponse } | { userId: string; url: string }> {
  const resolved = resolveUserAuthEnv()
  if (!resolved.env) return { response: NextResponse.json({ error: 'Server authentication is misconfigured.' }, { status: 500 }) }
  const { data, error } = await verifyAuth(req, { auth: 'user', env: resolved.env })
  if (error) return { response: NextResponse.json({ error: error.status === 500 ? 'Server authentication is misconfigured.' : 'Sign in to use model-assisted candidates.' }, { status: error.status === 500 ? 500 : 401 }) }
  const userId = data?.userClaims?.id
  if (!userId) return { response: NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }) }
  return { userId, url: resolved.env.url }
}

function isOwner(req: NextRequest, userId: string) {
  const local = process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1', '::1'].includes(req.nextUrl.hostname)
  return local || userId === process.env.DELTA_OPERATION_ALLOWED_USER_ID
}

export async function deltaOwner(req: NextRequest): Promise<{ response: NextResponse } | { userId: string; url: string }> {
  const user = await deltaUser(req)
  if ('response' in user) return user
  if (!isOwner(req, user.userId)) {
    return { response: NextResponse.json({ error: 'Model-assisted candidates are not enabled for this account.' }, { status: 403 }) }
  }
  return user
}

// Tester grants apply only to project review, never other owner tools.
export async function deltaReviewer(req: NextRequest): Promise<{ response: NextResponse } | { userId: string; url: string; tester: boolean }> {
  const user = await deltaUser(req)
  if ('response' in user) return user
  if (isOwner(req, user.userId)) return { ...user, tester: false }
  try {
    const client = projectUserClient(user.url, req.headers.get('Authorization') ?? '')
    const grant = await client.from('mission_review_access').select('expires_at').eq('user_id', user.userId).maybeSingle()
    if (grant.error) throw grant.error
    if (grant.data && Date.parse(grant.data.expires_at) > Date.now()) return { ...user, tester: true }
    return { response: NextResponse.json({ error: 'AI assistance is not enabled for this account. Your work is saved privately.' }, { status: 403 }) }
  } catch {
    return { response: NextResponse.json({ error: 'Could not check AI access. Your saved work is unchanged.' }, { status: 503 }) }
  }
}

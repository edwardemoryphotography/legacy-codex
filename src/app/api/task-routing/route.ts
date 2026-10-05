import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@supabase/server/core'
import { resolveUserAuthEnv } from '@/lib/supabase/userAuthEnv'
import { projectUserClient } from '@/lib/projectReviewServer'
import { loadConfirmedLessons } from '@/lib/projectLessonsServer'
import { loadRouteLearning, parseRouteCorrection } from '@/lib/routeLearningServer'
import { MISSION_UUID } from '@/lib/learnedContextServer'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store' }
async function account(req: NextRequest) {
  const resolved = resolveUserAuthEnv()
  if (!resolved.env) return { response: NextResponse.json({ error: 'Authentication unavailable.' }, { status: 503, headers }) }
  const { data, error } = await verifyAuth(req, { auth: 'user', env: resolved.env })
  if (error || !data?.userClaims?.id) return { response: NextResponse.json({ error: 'Sign in to read saved routing context.' }, { status: 401, headers }) }
  return { userId: data.userClaims.id, client: projectUserClient(resolved.env.url, req.headers.get('Authorization') ?? '') }
}
async function verifyMission(client: ReturnType<typeof projectUserClient>, userId: string, missionId: string) {
  const result = await client.from('missions').select('id').eq('id', missionId).eq('user_id', userId).single()
  if (result.error || !result.data) throw new Error('Project scope unavailable.')
}
export async function GET(req: NextRequest) {
  try {
    const auth = await account(req)
    if ('response' in auth) return auth.response
    const missionId = req.nextUrl.searchParams.get('missionId')
    if (missionId !== null && !MISSION_UUID.test(missionId)) return NextResponse.json({ error: 'Invalid project scope.' }, { status: 400, headers })
    if (missionId) await verifyMission(auth.client, auth.userId, missionId)
    const [lessons, weights] = await Promise.all([
      loadConfirmedLessons(auth.client, auth.userId, missionId ? [missionId] : []), loadRouteLearning(auth.client, auth.userId),
    ])
    return NextResponse.json({ userId: auth.userId, missionId, lessons, weights }, { headers })
  } catch { return NextResponse.json({ error: 'Saved lessons or routing corrections could not be read.' }, { status: 503, headers }) }
}
export async function POST(req: NextRequest) {
  try {
    const auth = await account(req)
    if ('response' in auth) return auth.response
    const text = await req.text()
    if (Buffer.byteLength(text) > 4096) return NextResponse.json({ error: 'Correction too large.' }, { status: 413, headers })
    let body
    try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid correction.' }, { status: 400, headers }) }
    const correction = parseRouteCorrection(body)
    if (!correction || typeof body.missionId !== 'string' || !MISSION_UUID.test(body.missionId) || typeof body.idempotencyKey !== 'string' || !MISSION_UUID.test(body.idempotencyKey)) return NextResponse.json({ error: 'A valid correction and saved project are required.' }, { status: 400, headers })
    await verifyMission(auth.client, auth.userId, body.missionId)
    const idempotencyKey = `route:correction:${body.idempotencyKey}`
    const detail = JSON.stringify(correction)
    const saved = await auth.client.from('mission_events').insert({ user_id: auth.userId, mission_id: body.missionId, type: 'task_route_corrected', detail, idempotency_key: idempotencyKey })
    if (saved.error) {
      if (saved.error.code !== '23505') throw new Error('Correction write unavailable.')
      const prior = await auth.client.from('mission_events').select('detail,mission_id,type').eq('user_id', auth.userId).eq('idempotency_key', idempotencyKey).single()
      if (prior.error || prior.data?.detail !== detail || prior.data.mission_id !== body.missionId || prior.data.type !== 'task_route_corrected') return NextResponse.json({ error: 'Correction retry differs from its saved record.' }, { status: 409, headers })
    }
    return NextResponse.json({ weights: await loadRouteLearning(auth.client, auth.userId) }, { headers })
  } catch { return NextResponse.json({ error: 'Correction could not be saved or restored. Retry with the same correction.' }, { status: 503, headers }) }
}

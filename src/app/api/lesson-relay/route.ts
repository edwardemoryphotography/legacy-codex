import { lessonExceptionFields } from '@/lib/lessonLimits'
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { deltaUser } from '@/lib/supabase/deltaAuth'
import { projectUserClient } from '@/lib/projectReviewServer'
import { decodeLessonRelay, MAX_RELAY_INPUT_LENGTH } from '@/lib/lessonRelay'

export const runtime = 'nodejs'
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
// Allow the maximum relay link and JSON request overhead, while bounding reads.
const MAX_BODY = MAX_RELAY_INPUT_LENGTH + 1_024

/** A relay is always explicit. It does not grant access to source records. */
export async function POST(req: NextRequest) {
  const signedIn = await deltaUser(req)
  if ('response' in signedIn) return signedIn.response
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY) return NextResponse.json({ error: 'The relay is too large.' }, { status: 413 })
  const raw = await req.text()
  if (Buffer.byteLength(raw) > MAX_BODY) return NextResponse.json({ error: 'The relay is too large.' }, { status: 413 })
  let body: Record<string, unknown>
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid relay request.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid relay request.' }, { status: 400 })
  try {
    const client = projectUserClient(signedIn.url, req.headers.get('Authorization') ?? '')
    if (body.action === 'retire') {
      if (typeof body.lessonId !== 'string' || !UUID.test(body.lessonId)) return NextResponse.json({ error: 'Choose a received lesson.' }, { status: 400 })
      const prior = await client.from('mission_events').select('id,mission_id,detail').eq('user_id', signedIn.userId)
        .eq('type', 'delta_lesson_confirmed').eq('id', body.lessonId).maybeSingle()
      if (prior.error) throw new Error('Could not inspect the lesson.')
      if (!prior.data) return NextResponse.json({ error: 'Received lesson not found.' }, { status: 404 })
      let received = false
      try { received = JSON.parse(prior.data.detail)?.origin === 'relay' } catch { /* invalid history is not an authorization */ }
      if (!received) return NextResponse.json({ error: 'This route only retires received lessons.' }, { status: 403 })
      const retired = await client.from('mission_events').insert({
        user_id: signedIn.userId, mission_id: prior.data.mission_id, type: 'delta_lesson_retired',
        detail: JSON.stringify({ lessonId: body.lessonId }), idempotency_key: `lesson:retire:${body.lessonId}`,
      })
      if (retired.error && retired.error.code !== '23505') throw new Error('Could not retire received lesson.')
      return NextResponse.json({ retired: true })
    }
    if (body.action !== 'receive' || typeof body.missionId !== 'string' || !UUID.test(body.missionId) ||
        typeof body.code !== 'string' || !['mission', 'account'].includes(body.scope as string)) {
      return NextResponse.json({ error: 'Choose a mission and a lesson to receive.' }, { status: 400 })
    }
    const relay = decodeLessonRelay(body.code)
    if (!relay) return NextResponse.json({ error: 'This is not a valid Legacy Codex lesson relay.' }, { status: 400 })
    const mission = await client.from('missions').select('id').eq('id', body.missionId).eq('user_id', signedIn.userId).maybeSingle()
    if (mission.error) throw new Error('Could not confirm mission ownership.')
    if (!mission.data) return NextResponse.json({ error: 'Choose one of your saved missions.' }, { status: 404 })

    // One receiver can inherit the same rule under two different scopes or
    // missions intentionally; retrying the *same* choice never duplicates it.
    const digest = createHash('sha256').update(JSON.stringify({
      userId: signedIn.userId, missionId: body.missionId, scope: body.scope, relay,
    })).digest('hex')
    const ref = `relay:${digest}`
    const now = new Date().toISOString()
    const saved = await client.from('mission_events').insert({
      user_id: signedIn.userId, mission_id: body.missionId, type: 'delta_lesson_confirmed',
      idempotency_key: `lesson:relay:${digest}`,
      detail: JSON.stringify({
        rule: relay.rule, whenToApply: relay.whenToApply, ...lessonExceptionFields(relay), scope: body.scope,
        origin: 'relay', reviewedAt: now, sourceIds: [ref],
        sourceRefs: [{ id: ref, label: 'Lesson shared with you', status: 'Received text; original source not independently verified' }],
      }),
    })
    if (saved.error && saved.error.code !== '23505') throw new Error('Could not save the received lesson.')
    return NextResponse.json({ received: true })
  } catch {
    console.error('/api/lesson-relay failed [read-or-persistence]')
    return NextResponse.json({ error: 'The lesson could not be saved. Your existing work is unchanged.' }, { status: 503 })
  }
}

export async function GET(req: NextRequest) {
  const signedIn = await deltaUser(req)
  if ('response' in signedIn) return signedIn.response
  const missionId = req.nextUrl.searchParams.get('missionId')
  if (!missionId || !UUID.test(missionId)) return NextResponse.json({ error: 'Choose one saved mission.' }, { status: 400 })
  try {
    const client = projectUserClient(signedIn.url, req.headers.get('Authorization') ?? '')
    const mission = await client.from('missions').select('id').eq('id', missionId).eq('user_id', signedIn.userId).maybeSingle()
    if (mission.error) throw new Error('Mission read failed.')
    if (!mission.data) return NextResponse.json({ error: 'Mission not found.' }, { status: 404 })
    const { data, error } = await client.from('mission_events').select('id,mission_id,detail,created_at')
      .eq('user_id', signedIn.userId).eq('mission_id', missionId).eq('type', 'delta_lesson_confirmed')
      .order('created_at', { ascending: false }).limit(50)
    if (error) throw new Error('Lesson history read failed.')
    const received = (data ?? []).flatMap(row => {
      let detail: Record<string, unknown>
      try { detail = JSON.parse(row.detail) } catch { return [] }
      if (!detail || detail.origin !== 'relay' || typeof detail.rule !== 'string' || typeof detail.whenToApply !== 'string') return []
      return [{ id: row.id, rule: detail.rule, whenToApply: detail.whenToApply, ...lessonExceptionFields(detail), confirmedAt: row.created_at }]
    })
    if (!received.length) return NextResponse.json({ received: [] })
    const retirements = await client.from('mission_events').select('idempotency_key')
      .eq('user_id', signedIn.userId).eq('type', 'delta_lesson_retired')
      .in('idempotency_key', received.map(row => `lesson:retire:${row.id}`))
    if (retirements.error) throw new Error('Lesson retirement read failed.')
    const retired = new Set((retirements.data ?? []).map(row => row.idempotency_key))
    return NextResponse.json({ received: received.filter(row => !retired.has(`lesson:retire:${row.id}`)) })
  } catch {
    return NextResponse.json({ error: 'Received lessons could not be loaded. Your saved work is unchanged.' }, { status: 503 })
  }
}

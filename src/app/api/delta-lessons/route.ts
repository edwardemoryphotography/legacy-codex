import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { deltaOwner } from '@/lib/supabase/deltaAuth'
import { loadProjectContext, projectUserClient } from '@/lib/projectReviewServer'
import { cachedProjectReview, projectIsReviewable } from '@/lib/projectReviewStore'

export const runtime = 'nodejs'
export const maxDuration = 60
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

// No model call or elevated database client. Each rule is an explicit human
// confirmation; retirement appends a tombstone and preserves provenance.
export async function POST(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 8_192) return NextResponse.json({ error: 'Lesson request is too large.' }, { status: 413 })
  const raw = await req.text()
  if (Buffer.byteLength(raw) > 8_192) return NextResponse.json({ error: 'Lesson request is too large.' }, { status: 413 })
  let body: Record<string, unknown>
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid lesson request.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid lesson request.' }, { status: 400 })
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    if (body.action === 'retire') {
      if (typeof body.lessonId !== 'string' || !UUID.test(body.lessonId)) return NextResponse.json({ error: 'A saved lesson is required.' }, { status: 400 })
      const lesson = await client.from('mission_events').select('id,mission_id').eq('user_id', owner.userId).eq('type', 'delta_lesson_confirmed').eq('id', body.lessonId).single()
      if (lesson.error || !lesson.data) return NextResponse.json({ error: 'The lesson is unavailable in this account.' }, { status: 404 })
      const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: lesson.data.mission_id, type: 'delta_lesson_retired', detail: JSON.stringify({ lessonId: body.lessonId }), idempotency_key: `lesson:retire:${body.lessonId}` })
      if (saved.error && saved.error.code !== '23505') throw new Error('Lesson retirement failed.')
      return NextResponse.json({ retired: true })
    }
    if (body.action !== 'confirm' || typeof body.missionId !== 'string' || !UUID.test(body.missionId) ||
        typeof body.contextKey !== 'string' || !/^[a-f0-9]{64}$/.test(body.contextKey) ||
        typeof body.rule !== 'string' || !body.rule.trim() || body.rule.length > 1_000 ||
        typeof body.whenToApply !== 'string' || !body.whenToApply.trim() || body.whenToApply.length > 500 ||
        !['mission', 'account'].includes(body.scope as string)) {
      return NextResponse.json({ error: 'Name the lesson, when it applies, and its scope.' }, { status: 400 })
    }
    const digest = createHash('sha256').update(JSON.stringify({ contextKey: body.contextKey,
      rule: body.rule.trim(), whenToApply: body.whenToApply.trim(), scope: body.scope })).digest('hex')
    const key = `lesson:confirm:${digest}`
    const existing = await client.from('mission_events').select('id').eq('user_id', owner.userId)
      .eq('mission_id', body.missionId).eq('type', 'delta_lesson_confirmed').eq('idempotency_key', key).maybeSingle()
    if (existing.error) throw new Error('Could not check lesson confirmation.')
    // A successful confirmation changes context. A retried identical request
    // must still acknowledge the already recorded confirmation, not return 409.
    if (existing.data) return NextResponse.json({ confirmed: true })
    const context = await loadProjectContext(client, owner.userId, body.missionId)
    const review = projectIsReviewable(context) ? await cachedProjectReview(client, owner.userId, context) : null
    if (!review || review.contextKey !== body.contextKey) return NextResponse.json({ error: 'The project changed or the review expired. Review it again before confirming a lesson.' }, { status: 409 })
    const sourceIds = review.lesson?.sourceIds ?? review.sourceIds
    const sourceRefs = context.sources.filter(source => sourceIds.includes(source.id)).map(({ id, label, status, url }) => ({ id, label, status, url }))
    const lesson = { rule: body.rule.trim(), whenToApply: body.whenToApply.trim(), scope: body.scope,
      reviewedAt: review.reviewedAt, sourceIds, sourceRefs }
    const current = await loadProjectContext(client, owner.userId, body.missionId)
    if (current.contextKey !== context.contextKey) return NextResponse.json({ error: 'Your project changed while confirming. Review the updated context first.' }, { status: 409 })
    const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: body.missionId,
      type: 'delta_lesson_confirmed', detail: JSON.stringify(lesson), idempotency_key: key })
    if (saved.error && saved.error.code !== '23505') throw new Error('Lesson confirmation failed.')
    return NextResponse.json({ confirmed: true })
  } catch {
    console.error('/api/delta-lessons failed [read-or-persistence]')
    return NextResponse.json({ error: 'The lesson could not be recorded. Your saved work is unchanged.' }, { status: 503 })
  }
}

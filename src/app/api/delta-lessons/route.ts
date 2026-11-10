import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { deltaOwner } from '@/lib/supabase/deltaAuth'
import { loadProjectContext, projectUserClient } from '@/lib/projectReviewServer'
import { cachedProjectReview, projectIsReviewable } from '@/lib/projectReviewStore'
import { INCIDENT_CANDIDATES, findIncidentCandidate, type CandidateState, type IncidentCandidate } from '@/lib/incidentCandidates'

export const runtime = 'nodejs'
export const maxDuration = 60
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

type Client = ReturnType<typeof projectUserClient>

// Derived from the append-only ledger on every read. A candidate that was
// never answered stays "proposed"; nothing is stored to make it look decided.
// `generation` is how many times this account has confirmed the candidate. It
// names the single slot the next confirmation or rejection may occupy.
async function candidateState(client: Client, userId: string, candidate: IncidentCandidate): Promise<CandidateState> {
  const confirmed = await client.from('mission_events').select('id,created_at').eq('user_id', userId)
    .eq('type', 'delta_lesson_confirmed').like('idempotency_key', `lesson:incident:${candidate.id}:%`)
    .order('created_at', { ascending: false }).limit(50)
  if (confirmed.error) throw new Error('Could not read candidate confirmations.')
  const rows = confirmed.data ?? []
  // Never guess a slot from a clipped read.
  if (rows.length >= 50) throw new Error('Too many confirmations to derive a slot.')
  const generation = rows.length
  if (rows.length) {
    const retired = await client.from('mission_events').select('idempotency_key').eq('user_id', userId)
      .eq('type', 'delta_lesson_retired').in('idempotency_key', rows.map(row => `lesson:retire:${row.id}`))
    if (retired.error) throw new Error('Could not read candidate retirements.')
    const inactive = new Set((retired.data ?? []).map(row => row.idempotency_key))
    const active = rows.find(row => !inactive.has(`lesson:retire:${row.id}`))
    if (active) return { id: candidate.id, state: 'confirmed', lessonId: active.id, at: active.created_at, generation }
  }
  const rejected = await client.from('mission_events').select('created_at').eq('user_id', userId)
    .eq('type', 'delta_lesson_candidate_rejected').eq('idempotency_key', `lesson:incident-reject:${candidate.id}:g${generation}`).maybeSingle()
  if (rejected.error) throw new Error('Could not read candidate rejections.')
  if (rejected.data) return { id: candidate.id, state: 'rejected', lessonId: null, at: rejected.data.created_at, generation }
  return rows.length ? { id: candidate.id, state: 'retired', lessonId: null, at: rows[0].created_at, generation }
    : { id: candidate.id, state: 'proposed', lessonId: null, at: null, generation }
}

// Owner-only read of where each real incident candidate stands. No model call.
export async function GET(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    const candidates = await Promise.all(INCIDENT_CANDIDATES.map(candidate => candidateState(client, owner.userId, candidate)))
    return NextResponse.json({ candidates }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Incident candidates could not be read. Your saved work is unchanged.' }, { status: 503 })
  }
}

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
    if (body.action === 'confirm_incident' || body.action === 'reject_incident') {
      // The candidate, its mechanism and its sources come from the reviewed
      // repository record. The client supplies only the owner's own words.
      const candidate = findIncidentCandidate(body.candidateId)
      if (!candidate || typeof body.missionId !== 'string' || !UUID.test(body.missionId)) return NextResponse.json({ error: 'Choose a real incident candidate and one of your missions.' }, { status: 400 })
      const mission = await client.from('missions').select('id').eq('id', body.missionId).eq('user_id', owner.userId).maybeSingle()
      if (mission.error) throw new Error('Could not confirm mission ownership.')
      if (!mission.data) return NextResponse.json({ error: 'Choose one of your saved missions.' }, { status: 404 })
      const state = await candidateState(client, owner.userId, candidate)
      if (body.action === 'reject_incident') {
        if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 500)) return NextResponse.json({ error: 'Keep the reason under 500 characters.' }, { status: 400 })
        if (state.state === 'confirmed') return NextResponse.json({ error: 'This incident has an active rule. Stop using it before rejecting the candidate.' }, { status: 409 })
        const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: body.missionId, type: 'delta_lesson_candidate_rejected',
          detail: JSON.stringify({ candidateId: candidate.id, reason: typeof body.reason === 'string' ? body.reason.trim() : '' }), idempotency_key: `lesson:incident-reject:${candidate.id}:g${state.generation}` })
        if (saved.error && saved.error.code !== '23505') throw new Error('Candidate rejection failed.')
        return NextResponse.json({ rejected: true })
      }
      if (typeof body.rule !== 'string' || !body.rule.trim() || body.rule.length > 1_000 ||
          typeof body.whenToApply !== 'string' || !body.whenToApply.trim() || body.whenToApply.length > 500 ||
          typeof body.exceptions !== 'string' || !body.exceptions.trim() || body.exceptions.length > 800 ||
          !['mission', 'account'].includes(body.scope as string)) {
        return NextResponse.json({ error: 'Name the rule, when it applies, when it does not, and its scope.' }, { status: 400 })
      }
      const words = { rule: body.rule.trim(), whenToApply: body.whenToApply.trim(), exceptions: body.exceptions.trim(), scope: body.scope as string }
      // A retried identical request is acknowledged; anything else must not stack.
      const sameAs = async (column: 'id' | 'idempotency_key', value: string) => {
        const row = await client.from('mission_events').select('mission_id,detail').eq('user_id', owner.userId)
          .eq('type', 'delta_lesson_confirmed').eq(column, value).maybeSingle()
        if (row.error || !row.data) throw new Error('Could not read the active confirmation.')
        let saved: Record<string, unknown> = {}
        try { saved = JSON.parse(row.data.detail ?? '{}') } catch { /* unreadable detail never matches */ }
        return row.data.mission_id === body.missionId && (['rule', 'whenToApply', 'exceptions', 'scope'] as const).every(field => saved[field] === words[field])
      }
      if (state.state === 'confirmed') {
        return await sameAs('id', state.lessonId!) ? NextResponse.json({ confirmed: true })
          : NextResponse.json({ error: 'This incident already has an active rule. Stop using it before confirming different words.' }, { status: 409 })
      }
      // One slot per confirmation generation, whatever the wording. The ledger's
      // unique (user_id, idempotency_key) index then lets exactly one concurrent
      // confirmation win, and a retired rule can be confirmed again unchanged.
      const key = `lesson:incident:${candidate.id}:g${state.generation}`
      const sourceRefs = candidate.sources.map(source => ({ id: `incident:${candidate.id}:${source.id}`, label: source.label, status: source.status, url: source.url }))
      const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: body.missionId, type: 'delta_lesson_confirmed', idempotency_key: key,
        detail: JSON.stringify({ ...words, origin: 'incident', candidateId: candidate.id, mechanism: candidate.mechanism,
          ownerEdited: words.rule !== candidate.proposedRule || words.whenToApply !== candidate.whenToApply || words.exceptions !== candidate.exceptions,
          reviewedAt: new Date().toISOString(), sourceIds: sourceRefs.map(ref => ref.id), sourceRefs }) })
      if (saved.error?.code === '23505') {
        return await sameAs('idempotency_key', key) ? NextResponse.json({ confirmed: true })
          : NextResponse.json({ error: 'Another confirmation of this incident was recorded first. Reload to see the active rule.' }, { status: 409 })
      }
      if (saved.error) throw new Error('Incident lesson confirmation failed.')
      return NextResponse.json({ confirmed: true })
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

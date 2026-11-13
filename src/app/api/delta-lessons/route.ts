import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { deltaOwner } from '@/lib/supabase/deltaAuth'
import { loadProjectContext, projectUserClient } from '@/lib/projectReviewServer'
import { cachedProjectReview, projectIsReviewable } from '@/lib/projectReviewStore'
import { INCIDENT_CANDIDATES, type CandidateState } from '@/lib/incidentCandidates'
import { findReviewableLessonCandidate, reviewCandidateSources, type ReviewableLessonCandidate } from '@/lib/historicalLessonCandidates'

export const runtime = 'nodejs'
export const maxDuration = 60
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

type Client = ReturnType<typeof projectUserClient>

// Derived from the append-only ledger on every read. A candidate that was
// never answered stays "proposed"; nothing is stored to make it look decided.
// Every decision on a candidate, confirmation or rejection, takes the next
// numbered slot `lesson:incident:<id>:g<n>`. `generation` is the next free slot.
const DECISIONS = ['delta_lesson_confirmed', 'delta_lesson_candidate_rejected']
const candidateKey = (candidate: ReviewableLessonCandidate) =>
  `${'record' in candidate ? 'lesson:casebook' : 'lesson:incident'}:${candidate.id}`

async function candidateState(client: Client, userId: string, candidate: ReviewableLessonCandidate): Promise<CandidateState> {
  const decided = await client.from('mission_events').select('id,created_at,type,idempotency_key').eq('user_id', userId)
    .in('type', DECISIONS).like('idempotency_key', `${candidateKey(candidate)}:g%`).limit(50)
  if (decided.error) throw new Error('Could not read candidate decisions.')
  const rows = decided.data ?? []
  // Never guess a slot from a clipped read.
  if (rows.length >= 50) throw new Error('Too many decisions to derive a slot.')
  const generation = rows.length
  const base = { id: candidate.id, lessonId: null, generation }
  if (!generation) return { ...base, state: 'proposed', at: null }
  const latest = rows.find(row => row.idempotency_key === `${candidateKey(candidate)}:g${generation - 1}`)
  if (!latest) throw new Error('Decision slots are not contiguous.')
  if (latest.type !== 'delta_lesson_confirmed') return { ...base, state: 'rejected', at: latest.created_at }
  const retired = await client.from('mission_events').select('id').eq('user_id', userId)
    .eq('type', 'delta_lesson_retired').eq('idempotency_key', `lesson:retire:${latest.id}`).maybeSingle()
  if (retired.error) throw new Error('Could not read candidate retirements.')
  return retired.data ? { ...base, state: 'retired', at: latest.created_at }
    : { ...base, state: 'confirmed', lessonId: latest.id, at: latest.created_at }
}

// Owner-only read of where each real incident candidate stands. No model call.
export async function GET(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    // Fetch the selected historical record on demand instead of doing 33
    // unnecessary ledger reads on every Mission view.
    const requestedId = req.nextUrl.searchParams.get('candidateId')
    const selected = requestedId ? findReviewableLessonCandidate(requestedId) : null
    if (requestedId && !selected) return NextResponse.json({ error: 'Unknown lesson candidate.' }, { status: 400 })
    const candidates = await Promise.all((selected ? [selected] : INCIDENT_CANDIDATES).map(candidate => candidateState(client, owner.userId, candidate)))
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
    if (['confirm_incident', 'reject_incident', 'confirm_casebook', 'reject_casebook'].includes(body.action as string)) {
      // The candidate, its mechanism and its sources come from the reviewed
      // repository record. The client supplies only the owner's own words.
      const candidate = findReviewableLessonCandidate(body.candidateId)
      const historical = candidate !== null && 'record' in candidate
      if (candidate && historical !== (body.action === 'confirm_casebook' || body.action === 'reject_casebook')) {
        return NextResponse.json({ error: 'The candidate type does not match the requested action.' }, { status: 400 })
      }
      if (!candidate || typeof body.missionId !== 'string' || !UUID.test(body.missionId)) return NextResponse.json({ error: 'Choose a real incident candidate and one of your missions.' }, { status: 400 })
      const mission = await client.from('missions').select('id').eq('id', body.missionId).eq('user_id', owner.userId).maybeSingle()
      if (mission.error) throw new Error('Could not confirm mission ownership.')
      if (!mission.data) return NextResponse.json({ error: 'Choose one of your saved missions.' }, { status: 404 })
      const state = await candidateState(client, owner.userId, candidate)
      if (body.action === 'reject_incident' || body.action === 'reject_casebook') {
        if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 500)) return NextResponse.json({ error: 'Keep the reason under 500 characters.' }, { status: 400 })
        if (state.state === 'confirmed') return NextResponse.json({ error: 'This candidate has an active rule. Retire it before rejecting the candidate.' }, { status: 409 })
        if (state.state === 'rejected') return NextResponse.json({ rejected: true })
        // Same slot a confirmation would take, so the two can never both be stored.
        const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: body.missionId, type: 'delta_lesson_candidate_rejected',
          detail: JSON.stringify({ candidateId: candidate.id, origin: historical ? 'casebook' : 'incident', reason: typeof body.reason === 'string' ? body.reason.trim() : '' }), idempotency_key: `${candidateKey(candidate)}:g${state.generation}` })
        if (saved.error?.code === '23505') {
          return (await candidateState(client, owner.userId, candidate)).state === 'rejected' ? NextResponse.json({ rejected: true })
            : NextResponse.json({ error: 'Another decision on this incident was recorded first. Reload to see it.' }, { status: 409 })
        }
        if (saved.error) throw new Error('Candidate rejection failed.')
        return NextResponse.json({ rejected: true })
      }
      if (typeof body.rule !== 'string' || !body.rule.trim() || body.rule.length > 1_000 ||
          typeof body.whenToApply !== 'string' || !body.whenToApply.trim() || body.whenToApply.length > 500 ||
          typeof body.exceptions !== 'string' || !body.exceptions.trim() || body.exceptions.length > 800 ||
          !['mission', 'account'].includes(body.scope as string)) {
        return NextResponse.json({ error: 'Name the rule, when it applies, when it does not, and its scope.' }, { status: 400 })
      }
      // A historical entry never becomes authoritative by merely appearing
      // in the app. The owner must explicitly acknowledge its source limits.
      if (historical && body.historicalReviewed !== true) {
        return NextResponse.json({ error: 'Review the references and acknowledge source limitations before confirming.' }, { status: 400 })
      }
      const words = { rule: body.rule.trim(), whenToApply: body.whenToApply.trim(), exceptions: body.exceptions.trim(), scope: body.scope as string }
      // A retried identical request is acknowledged; anything else must not stack.
      const sameAs = async (column: 'id' | 'idempotency_key', value: string) => {
        const row = await client.from('mission_events').select('mission_id,detail').eq('user_id', owner.userId)
          .eq('type', 'delta_lesson_confirmed').eq(column, value).maybeSingle()
        if (row.error) throw new Error('Could not read the active confirmation.')
        if (!row.data) return false // the slot was taken by a rejection
        let saved: Record<string, unknown> = {}
        try { saved = JSON.parse(row.data.detail ?? '{}') } catch { /* unreadable detail never matches */ }
        return row.data.mission_id === body.missionId && (['rule', 'whenToApply', 'exceptions', 'scope'] as const).every(field => saved[field] === words[field])
      }
      if (state.state === 'confirmed') {
        return await sameAs('id', state.lessonId!) ? NextResponse.json({ confirmed: true })
          : NextResponse.json({ error: 'This incident already has an active rule. Stop using it before confirming different words.' }, { status: 409 })
      }
      // One slot per decision, whatever the wording or kind. The ledger's
      // unique (user_id, idempotency_key) index then lets exactly one concurrent
      // confirmation win, and a retired rule can be confirmed again unchanged.
      const key = `${candidateKey(candidate)}:g${state.generation}`
      const sourceRefs = reviewCandidateSources(candidate)
      const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: body.missionId, type: 'delta_lesson_confirmed', idempotency_key: key,
        detail: JSON.stringify({ ...words, origin: historical ? 'casebook' : 'incident', candidateId: candidate.id,
          casebookId: candidate.casebookId,
          mechanism: historical ? candidate.record.sharedStructure : candidate.mechanism,
          documentaryStatus: historical ? candidate.record.recordStatus : 'user-verified-fix',
          sourceCoverage: historical ? candidate.record.sources.map(source => source.access) : ['public'],
          ownerAcknowledgedSourceLimits: historical,
          ownerEdited: words.rule !== candidate.proposedRule || words.whenToApply !== candidate.whenToApply || words.exceptions !== candidate.exceptions,
          reviewedAt: new Date().toISOString(), sourceIds: sourceRefs.map(ref => ref.id), sourceRefs }) })
      if (saved.error?.code === '23505') {
        return await sameAs('idempotency_key', key) ? NextResponse.json({ confirmed: true })
          : NextResponse.json({ error: 'Another decision on this incident was recorded first. Reload to see it.' }, { status: 409 })
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

import { historicalReview } from '@/lib/reviewHistory'
import { NextRequest, NextResponse } from 'next/server'
import { PROJECT_REVIEW_OUTPUT, PROJECT_REVIEW_RULES } from '@/lib/projectReviewPrompt'
import { deltaReviewer } from '@/lib/supabase/deltaAuth'
import { parseAssistanceNote } from '@/lib/missionAssistance'
import { loadProjectContext, projectUserClient } from '@/lib/projectReviewServer'
import { parseProjectReview, type ProjectReview, type ReviewProposal } from '@/lib/projectReview'
import { compactEvidenceSources } from '@/lib/reviewPacket'
import { unsupportedReviewAssertions } from '@/lib/claimIntegrity'
import { measureTransfer } from '@/lib/structuralTransfer'
import { isConcreteMove } from '@/lib/strategicDelta'
import { cachedProjectReview, projectIsReviewable } from '@/lib/projectReviewStore'
import { isModelChainConfigured, providerFailureReason, runProviderChainReviewStep } from '@/lib/modelProviderChain'

export const runtime = 'nodejs'
export const maxDuration = 120

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

// Rehydration reads the existing proposal only; opening/reloading the page
// never purchases another model call.
export async function GET(req: NextRequest) {
  const owner = await deltaReviewer(req)
  if ('response' in owner) return owner.response
  if (req.nextUrl.searchParams.get('capabilities') === '1') return NextResponse.json({ configured: isModelChainConfigured(), tester: owner.tester }, { headers: { 'Cache-Control': 'no-store' } })
  const missionId = req.nextUrl.searchParams.get('missionId')
  if (!missionId || !UUID.test(missionId)) return NextResponse.json({ error: 'A saved mission is required.' }, { status: 400 })
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    const context = await loadProjectContext(client, owner.userId, missionId)
    const history = await client.from('mission_events').select('detail').eq('user_id', owner.userId).eq('mission_id', missionId).eq('type', 'delta_reviewed').order('created_at', { ascending: false }).limit(1)
    if (history.error) throw new Error('Could not read review history.')
    const previousReview = history.data?.[0] ? historicalReview(history.data[0].detail, missionId) : null
    return NextResponse.json({ previousReview, review: projectIsReviewable(context) ? await cachedProjectReview(client, owner.userId, context) : null, lessons: context.lessons }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not restore the project review. Your saved work is unchanged.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const owner = await deltaReviewer(req)
  if ('response' in owner) return owner.response
  if (!isModelChainConfigured()) return NextResponse.json({ error: 'Project review is unavailable: model access is not configured.' }, { status: 503 })
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 32_768) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  const text = await req.text()
  if (Buffer.byteLength(text) > 32_768) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  let body: { missionId?: unknown; finishLine?: unknown; contextNote?: unknown; requestId?: unknown; previousReviewKey?: unknown; tier?: unknown }
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid review request.' }, { status: 400 }) }
  if (!body || typeof body.missionId !== 'string' || !UUID.test(body.missionId) || typeof body.finishLine !== 'string' || !body.finishLine.trim() || body.finishLine.length > 2_000) {
    return NextResponse.json({ error: 'A saved mission and finish line are required.' }, { status: 400 })
  }
  let stage = 'context'
  const note = parseAssistanceNote(body)
  if (note === null) return NextResponse.json({ error: 'Add an answer under 6,000 characters and try again.' }, { status: 400 })
  if (body.previousReviewKey !== undefined && (typeof body.previousReviewKey !== 'string' || !/^[a-f0-9]{64}$/.test(body.previousReviewKey))) return NextResponse.json({ error: 'The previous draft reference is invalid.' }, { status: 400 })
  // Economy is the default. Deep is an explicit investigation choice and gets
  // a longer, tier-appropriate budget; both keep the same validation gates.
  const tier: 'routine' | 'deep' = body.tier === 'deep' ? 'deep' : 'routine'
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    let context = await loadProjectContext(client, owner.userId, body.missionId)
    if (context.mission.finish_line !== body.finishLine) return NextResponse.json({ error: 'The finish line changed. Refresh your project before reviewing.' }, { status: 409 })
    if (!projectIsReviewable(context)) {
      return NextResponse.json({ operation: null, review: null, lessons: context.lessons })
    }
    if (note) {
      // The ownership read above precedes the write. Retries reuse the same
      // request ID, so a failed provider call cannot duplicate the answer.
      const key = `assistance:${owner.userId}:${body.missionId}:${note.requestId}`
      const existing = await client.from('mission_events').select('detail').eq('user_id', owner.userId).eq('mission_id', body.missionId).eq('idempotency_key', key).maybeSingle()
      if (existing.error) throw existing.error
      if (existing.data && existing.data.detail !== note.note) return NextResponse.json({ error: 'This answer changed. Submit it as a new request.' }, { status: 409 })
      if (!existing.data) {
        const previous = body.previousReviewKey ? await cachedProjectReview(client, owner.userId, context) : null
        if (body.previousReviewKey && previous?.contextKey !== body.previousReviewKey) return NextResponse.json({ error: 'The draft context changed or expired. Refresh before revising it; keep your answer to paste back in.' }, { status: 409 })
        const rows = [{ user_id: owner.userId, mission_id: body.missionId, type: 'delta_context_added', detail: note.note, idempotency_key: key }]
        const previousText = previous?.workDraft || previous?.clarification
        if (previousText) rows.push({ user_id: owner.userId, mission_id: body.missionId, type: 'delta_draft_context', detail: previousText, idempotency_key: `${key}:draft` })
        const savedNote = await client.from('mission_events').insert(rows)
        if (savedNote.error && savedNote.error.code !== '23505') return NextResponse.json({ error: 'Your answer could not be saved. Keep it here and retry.' }, { status: 503 })
      }
      context = await loadProjectContext(client, owner.userId, body.missionId)
    }
    const cached = await cachedProjectReview(client, owner.userId, context)
    if (cached) return NextResponse.json({ operation: cached.operation, review: cached, lessons: context.lessons })
    if (owner.tester) {
      const reserved = await client.rpc('reserve_mission_review')
      if (reserved.error) return NextResponse.json({ error: 'Could not reserve an AI request. Your context is saved.' }, { status: 503 })
      if (reserved.data !== true) return NextResponse.json({ error: 'Please wait a minute before trying again. If your tester allowance is used up, ask Eddie to renew it. Your context is saved.' }, { status: 429 })
    }
    // Economy makes ONE compact structured pass; Deep keeps the independent
    // draft -> critique sequence. Both use the same sources, validation gates
    // and persistence. The packet is bounded in Economy, not the integrity.
    const compact = tier === 'routine'
    const packetSources = compact ? compactEvidenceSources(context.sources) : context.sources
    const reviewWarnings = compact
      ? [...context.warnings, 'Economy: bounded evidence packet and one structured pass; no independent critique was run. Switch to Deep for a two-pass review.']
      : context.warnings
    const makePacket = (sources = packetSources) => JSON.stringify({ mission: { id: context.mission.id, title: context.mission.title.slice(0, 160),
      finishLine: body.finishLine, state: context.mission.state }, sources, warnings: reviewWarnings })
    const packet = makePacket()
    console.info('/api/delta-review packet', { tier, stage: 'assembly', packetChars: packet.length, sources: packetSources.length, fullSources: context.sources.length })
    const withheld = context.sources.filter(source => source.kind !== 'lesson')
    const comparingLessons = withheld.length !== context.sources.length
    let baseline: ReviewProposal | null = null
    let parsed: ReviewProposal | null = null
    const reviewDeadlineAt = Date.now() + (tier === 'deep' ? 100_000 : 45_000)
    const draftDeadlineAt = Date.now() + (tier === 'deep' ? 55_000 : 40_000)
    if (compact) {
      stage = 'review'
      const startedAt = Date.now()
      const single = await runProviderChainReviewStep({
        maxTokens: 2_600,
        system: PROJECT_REVIEW_RULES,
        requireToolOutput: true,
        tool: PROJECT_REVIEW_OUTPUT,
        deadlineAt: reviewDeadlineAt,
        tier,
        userContent: `Compare feasible moves and propose one reviewed decision from this context. Submit it through submit_project_review. Cite only supplied source IDs, state unknowns, and keep the operation concrete.\n${packet}`,
      })
      parsed = (single.stopReason === 'tool_use' || single.stopReason === 'structured_text') && single.toolInput
        ? parseProjectReview(JSON.stringify(single.toolInput), packetSources, body.missionId) : null
      console.info('/api/delta-review economy pass', { tier, stage: 'review', provider: single.provider, elapsedMs: Date.now() - startedAt, accepted: Boolean(parsed) })
    } else {
      stage = 'draft'
      const draft = await runProviderChainReviewStep({
        maxTokens: comparingLessons ? 4_200 : 1_600,
        system: PROJECT_REVIEW_RULES,
        requireToolOutput: comparingLessons,
        tool: PROJECT_REVIEW_OUTPUT,
        deadlineAt: draftDeadlineAt,
        tier,
        userContent: `Compare feasible moves and propose one choice from this context.${comparingLessons ? ' Submit the provisional choice through submit_project_review.' : ''}\n${makePacket(comparingLessons ? withheld : context.sources)}`,
      })
      if (comparingLessons) {
        baseline = (draft.stopReason === 'tool_use' || draft.stopReason === 'structured_text') && draft.toolInput ? parseProjectReview(JSON.stringify(draft.toolInput), withheld, body.missionId) : null
        // Model-asserted verification cannot qualify as a lesson-withheld baseline.
        if (baseline && unsupportedReviewAssertions(baseline).length) baseline = null
        // A malformed baseline cannot become a measured comparison. Still allow
        // the normal final critique to help the person, with unavailable metrics.
      } else if (draft.stopReason !== 'end_turn') return NextResponse.json({ error: 'The review draft did not complete. No recommendation was accepted.' }, { status: 502 })
      const draftText = comparingLessons ? JSON.stringify(baseline) : draft.text
      stage = 'critique'
      const final = await runProviderChainReviewStep({
        maxTokens: 4_200,
        system: PROJECT_REVIEW_RULES,
        requireToolOutput: true,
        tool: PROJECT_REVIEW_OUTPUT,
        deadlineAt: reviewDeadlineAt,
        tier,
        userContent: `Critique the draft independently against the original context. Does the chosen move beat the alternatives on impact, urgency, dependencies, reported capacity and uncertainty? Is resuming a saved action better? Does the finish condition describe an observable result? Does a missing fact change the winner? Find unsupported facts, stale evidence, duplicates and paraphrases of corrected approaches. Revise once; submit through submit_project_review. A self-check is still a model proposal, not verification.\nOriginal context:\n${packet}\nDraft (untrusted proposal):\n${draftText.slice(0, 10_000)}`,
      })
      parsed = (final.stopReason === 'tool_use' || final.stopReason === 'structured_text') && final.toolInput
        ? parseProjectReview(JSON.stringify(final.toolInput), packetSources, body.missionId) : null
    }
    stage = 'validation'
    if (!parsed || (parsed.operation && !isConcreteMove(parsed.operation, { title: context.mission.title, finishLine: context.mission.finish_line }))) {
      return NextResponse.json({ error: 'The review did not return a grounded choice with a finish condition. No recommendation was accepted.' }, { status: 502 })
    }
    const unsupportedClaims = unsupportedReviewAssertions(parsed)
    if (unsupportedClaims.length) {
      // No private model output is emitted to logs. Fail closed; do not cache or
      // present unverified completion claims as a reviewed result.
      console.warn('/api/delta-review blocked unsupported outcome claims', { fields: unsupportedClaims })
      return NextResponse.json({ error: 'This review claimed a verified or completed result without independent evidence. No recommendation was accepted.' }, { status: 502 })
    }
    // Do not apply a proposal if notes, corrections, commitments or sources
    // changed while the two model calls were running.
    stage = 'context-recheck'
    const current = await loadProjectContext(client, owner.userId, body.missionId)
    if (current.contextKey !== context.contextKey) return NextResponse.json({ error: 'Your project changed during review. Review the updated context.' }, { status: 409 })
    const reviewedAt = new Date().toISOString()
    const transferObservation = measureTransfer({ baseline, after: parsed, sources: packetSources, lessons: context.lessons, missionId: body.missionId, requestContextAdded: Boolean(note), reviewedAt, interventionEvidence: context.interventionEvidence })
    const review: ProjectReview = { ...parsed, transferObservation, missionId: body.missionId, finishLine: body.finishLine, sources: packetSources, warnings: reviewWarnings, contextKey: context.contextKey, reviewedAt, cached: false }
    // A cached proposal is not an action or evidence. It lives in the existing
    // transitional Delta ledger and is invalidated by context/correction changes.
    stage = 'persistence'
    const saved = await client.from('mission_events').insert({ user_id: owner.userId, mission_id: body.missionId, type: 'delta_reviewed', detail: JSON.stringify(review), idempotency_key: `review:${context.contextKey}:${Math.floor(Date.parse(review.reviewedAt) / 3_600_000)}` })
    if (saved.error?.code === '23505') {
      const winner = await cachedProjectReview(client, owner.userId, context)
      if (winner) return NextResponse.json({ operation: winner.operation, review: winner, lessons: context.lessons })
    }
    if (saved.error) return NextResponse.json({ error: 'The review could not be saved. Your commitments are unchanged.' }, { status: 503 })
    return NextResponse.json({ operation: review.operation, review, lessons: context.lessons })
  } catch (error) {
    console.error('/api/delta-review failed', {
      stage, ...providerFailureReason(error),
      ...(error instanceof Error && error.name !== 'Error' ? { errorName: error.name } : {}),
    })
    const message = stage === 'draft' || stage === 'critique'
      ? 'The model service could not complete the review. Your context is saved; no action or lesson was created.'
      : stage === 'persistence' ? 'The model answered, but its review could not be saved. No action or lesson was created.'
        : 'Project context could not be reconstructed. Your saved work is unchanged.'
    return NextResponse.json({ error: message, stage }, { status: 503 })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { PROJECT_REVIEW_OUTPUT, PROJECT_REVIEW_RULES } from '@/lib/projectReviewPrompt'
import { deltaOwner } from '@/lib/supabase/deltaAuth'
import { loadProjectContext, projectUserClient } from '@/lib/projectReviewServer'
import { parseProjectReview, type ProjectReview } from '@/lib/projectReview'
import { isConcreteMove } from '@/lib/strategicDelta'
import { cachedProjectReview, projectIsReviewable } from '@/lib/projectReviewStore'

export const runtime = 'nodejs'
export const maxDuration = 120

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

// Rehydration reads the existing proposal only; opening/reloading the page
// never purchases another model call.
export async function GET(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  if (req.nextUrl.searchParams.get('capabilities') === '1') return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) }, { headers: { 'Cache-Control': 'no-store' } })
  const missionId = req.nextUrl.searchParams.get('missionId')
  if (!missionId || !UUID.test(missionId)) return NextResponse.json({ error: 'A saved mission is required.' }, { status: 400 })
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    const context = await loadProjectContext(client, owner.userId, missionId)
    return NextResponse.json({ review: projectIsReviewable(context) ? await cachedProjectReview(client, owner.userId, context) : null, lessons: context.lessons }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not restore the project review. Your saved work is unchanged.' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Project review is unavailable: model access is not configured.' }, { status: 503 })
  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > 4_096) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  const text = await req.text()
  if (Buffer.byteLength(text) > 4_096) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  let body: { missionId?: unknown; finishLine?: unknown }
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid review request.' }, { status: 400 }) }
  if (!body || typeof body.missionId !== 'string' || !UUID.test(body.missionId) || typeof body.finishLine !== 'string' || !body.finishLine.trim() || body.finishLine.length > 2_000) {
    return NextResponse.json({ error: 'A saved mission and finish line are required.' }, { status: 400 })
  }
  let stage = 'context'
  try {
    const client = projectUserClient(owner.url, req.headers.get('Authorization') ?? '')
    const context = await loadProjectContext(client, owner.userId, body.missionId)
    if (context.mission.finish_line !== body.finishLine) return NextResponse.json({ error: 'The finish line changed. Refresh your project before reviewing.' }, { status: 409 })
    if (!projectIsReviewable(context)) {
      return NextResponse.json({ operation: null, review: null, lessons: context.lessons })
    }
    const cached = await cachedProjectReview(client, owner.userId, context)
    if (cached) return NextResponse.json({ operation: cached.operation, review: cached, lessons: context.lessons })
    const model = new Anthropic({ maxRetries: 0, timeout: 40_000 })
    // Full mission/lesson content is represented in the bounded sources.
    // Only identify the target here; do not bypass excerpts with raw records.
    const packet = JSON.stringify({ mission: { id: context.mission.id, title: context.mission.title.slice(0, 160),
      finishLine: body.finishLine, state: context.mission.state }, sources: context.sources, warnings: context.warnings })
    stage = 'draft'
    const draft = await model.messages.create({ model: 'claude-opus-5', max_tokens: 1_600, system: PROJECT_REVIEW_RULES, messages: [{ role: 'user', content: `Compare feasible moves and propose one choice from this context:\n${packet}` }] })
    if (draft.stop_reason !== 'end_turn') return NextResponse.json({ error: 'The review draft did not complete. No recommendation was accepted.' }, { status: 502 })
    const draftText = draft.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    stage = 'critique'
    const final = await model.messages.create({
      model: 'claude-opus-5', max_tokens: 2_600, system: PROJECT_REVIEW_RULES,
      tools: [PROJECT_REVIEW_OUTPUT], tool_choice: { type: 'tool', name: PROJECT_REVIEW_OUTPUT.name, disable_parallel_tool_use: true },
      messages: [{ role: 'user', content: `Critique the draft independently against the original context. Does the chosen move beat the alternatives on impact, urgency, dependencies, reported capacity and uncertainty? Is resuming a saved action better? Does the finish condition describe an observable result? Does a missing fact change the winner? Find unsupported facts, stale evidence, duplicates and paraphrases of corrected approaches. Revise once; submit through submit_project_review. A self-check is still a model proposal, not verification.\nOriginal context:\n${packet}\nDraft (untrusted proposal):\n${draftText.slice(0, 10_000)}` }],
    })
    stage = 'validation'
    const outputs = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === PROJECT_REVIEW_OUTPUT.name)
    const parsed = final.stop_reason === 'tool_use' && outputs.length === 1
      ? parseProjectReview(JSON.stringify(outputs[0].input), context.sources, body.missionId) : null
    if (!parsed || (parsed.operation && !isConcreteMove(parsed.operation, { title: context.mission.title, finishLine: context.mission.finish_line }))) {
      return NextResponse.json({ error: 'The review did not return a grounded choice with a finish condition. No recommendation was accepted.' }, { status: 502 })
    }
    // Do not apply a proposal if notes, corrections, commitments or sources
    // changed while the two model calls were running.
    stage = 'context-recheck'
    const current = await loadProjectContext(client, owner.userId, body.missionId)
    if (current.contextKey !== context.contextKey) return NextResponse.json({ error: 'Your project changed during review. Review the updated context.' }, { status: 409 })
    const review: ProjectReview = { ...parsed, missionId: body.missionId, finishLine: body.finishLine, sources: context.sources, warnings: context.warnings, contextKey: context.contextKey, reviewedAt: new Date().toISOString(), cached: false }
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
    const providerStatus = error instanceof Anthropic.APIError ? error.status : undefined
    console.error('/api/delta-review failed', { stage, providerStatus })
    const message = stage === 'draft' || stage === 'critique'
      ? 'The model service could not complete the review. Your context is saved; no action or lesson was created.'
      : stage === 'persistence' ? 'The model answered, but its review could not be saved. No action or lesson was created.'
        : 'Project context could not be reconstructed. Your saved work is unchanged.'
    return NextResponse.json({ error: message, stage }, { status: 503 })
  }
}

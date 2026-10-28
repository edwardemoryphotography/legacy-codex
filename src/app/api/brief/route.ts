import { loadLearnedContext, MISSION_UUID } from '@/lib/learnedContextServer'
import { NextRequest, NextResponse } from 'next/server'
import { ARCHITECT_SCAN_SYSTEM_PROMPT, BREAK_WALL_SYSTEM_PROMPT, DAILY_BRIEF_SYSTEM_PROMPT } from '@/lib/cognitiveDoctrine'
import { buildBriefDirective, MAX_FIELD_LENGTH, parseBriefTarget, presentBriefText, SINGLE_MISSION_MODES, type BriefMissionContext, type BriefMode, type BriefTarget } from '@/lib/dailyBrief'
import { deltaOwner } from '@/lib/supabase/deltaAuth'
import { isModelChainConfigured, runProviderChainText } from '@/lib/modelProviderChain'

export const runtime = 'nodejs'

export const maxDuration = 60
const MAX_MISSIONS = 40
const MODES: BriefMode[] = ['daily_brief', 'triage', 'question', 'architect', 'unblock']
const SYSTEM_PROMPTS: Record<BriefMode, string> = {
  daily_brief: DAILY_BRIEF_SYSTEM_PROMPT,
  triage: DAILY_BRIEF_SYSTEM_PROMPT,
  question: DAILY_BRIEF_SYSTEM_PROMPT,
  architect: ARCHITECT_SCAN_SYSTEM_PROMPT,
  unblock: BREAK_WALL_SYSTEM_PROMPT,
}

export async function GET() {
  return NextResponse.json({ configured: isModelChainConfigured() })
}

export async function POST(req: NextRequest) {
  // Every visitor is signed in as an anonymous Supabase guest, so "has a
  // user" is not a boundary for a paid model call. Use the same owner gate as
  // the Strategic Delta routes: 401 without a valid session, 403 for any
  // account that is not the configured owner — both before any model call.
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  if (!isModelChainConfigured()) {
    return NextResponse.json(
      { error: 'No model provider is configured on the server for Daily Brief.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 })
  }
  const { mode, question, missions, missionIds, target } = (body ?? {}) as {
    missionIds?: unknown
    target?: unknown
    mode?: unknown
    question?: unknown
    missions?: unknown
  }

  if (typeof mode !== 'string' || !MODES.includes(mode as BriefMode)) {
    return NextResponse.json({ error: `mode must be one of: ${MODES.join(', ')}` }, { status: 400 })
  }
  if (!Array.isArray(missions)) {
    return NextResponse.json({ error: 'missions must be an array.' }, { status: 400 })
  }
  if (missions.length > MAX_MISSIONS) {
    return NextResponse.json({ error: `Too many missions in one request (max ${MAX_MISSIONS}).` }, { status: 400 })
  }

  if (missionIds !== undefined && (!Array.isArray(missionIds) || missionIds.length !== missions.length || missionIds.length > MAX_MISSIONS || missionIds.some(id => typeof id !== 'string' || !MISSION_UUID.test(id)))) return NextResponse.json({ error: 'Invalid mission scope.' }, { status: 400 })

  // Re-narrow on the server rather than trusting the client's shape — the
  // client is expected to send what missionsToBriefContext() produces, but
  // this route never assumes it did. Every text field is clamped to the same
  // 400-character ceiling the client already clips to, so a hand-made
  // request cannot inflate the prompt.
  const safeMissions: BriefMissionContext[] = missions.map((entry, index) => {
    const r = (entry ?? {}) as Record<string, unknown>
    return {
      ...(Array.isArray(missionIds) ? { missionId: missionIds[index] as string } : {}),
      title: clamp(r.title) ?? '',
      state: (clamp(r.state) ?? 'candidate') as BriefMissionContext['state'],
      why: clamp(r.why) ?? '',
      finishLine: clamp(r.finishLine),
      blocker: clamp(r.blocker),
      capacityMismatch: Boolean(r.capacityMismatch),
    }
  })
  const safeQuestion = clamp(question) ?? undefined
  if (mode === 'question' && !safeQuestion?.trim()) {
    return NextResponse.json({ error: 'A question is required for mode "question".' }, { status: 400 })
  }

  // Architect Scan and Break Wall answer about exactly one scoped mission, so
  // the model never sees (or links to) the rest of the roster.
  let safeTarget: BriefTarget | undefined
  if (SINGLE_MISSION_MODES.includes(mode as BriefMode)) {
    if (safeMissions.length !== 1 || !Array.isArray(missionIds)) {
      return NextResponse.json({ error: 'Choose exactly one saved mission.' }, { status: 400 })
    }
    const parsed = parseBriefTarget(mode as BriefMode, target, safeMissions[0])
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    safeTarget = parsed.target
  }

  const directive = buildBriefDirective(mode as BriefMode, safeMissions, safeQuestion, safeTarget)

  try {
    const learnedContext = await loadLearnedContext(owner.url, req.headers.get('Authorization') ?? '', owner.userId, Array.isArray(missionIds) ? missionIds.filter((id): id is string => typeof id === 'string') : [])
    const response = await runProviderChainText({
      maxTokens: 1024,
      system: SYSTEM_PROMPTS[mode as BriefMode],
      userContent: `${directive}\n\n${learnedContext}`,
      timeoutMs: 40_000,
    })

    return NextResponse.json({ text: presentBriefText(mode as BriefMode, response.text), provider: response.provider, model: response.model, fallbacks: response.fallbacks })
  } catch {
    console.error('/api/brief failed [learning-or-provider]')
    return NextResponse.json({ error: 'Daily Brief unavailable: saved learning or the model could not be read. Retry without replacing your saved work.' }, { status: 503 })
  }
}

function clamp(value: unknown): string | null {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD_LENGTH) : null
}

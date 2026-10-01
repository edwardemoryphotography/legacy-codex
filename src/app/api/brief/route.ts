import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { resolveEnv, verifyAuth } from '@supabase/server/core'
import { DAILY_BRIEF_SYSTEM_PROMPT } from '@/lib/cognitiveDoctrine'
import { buildBriefDirective, type BriefMissionContext, type BriefMode } from '@/lib/dailyBrief'

export const runtime = 'nodejs'

const MODEL = 'claude-opus-5'
const MAX_MISSIONS = 40
const MAX_QUESTION_LENGTH = 2000
const MODES: BriefMode[] = ['daily_brief', 'triage', 'question']

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(req: NextRequest) {
  // Same auth pattern as /api/analyze: resolve env before verifying, and
  // keep the 500-vs-401 split (server misconfiguration is not the caller's
  // missing/invalid credential). See that route for the full reasoning.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasJwksConfig = Boolean(process.env.SUPABASE_JWKS || process.env.SUPABASE_JWKS_URL)
  const { data: authEnv, error: envError } = resolveEnv({
    ...(url ? { url } : {}),
  })
  if (authEnv && !hasJwksConfig) {
    try {
      // Never take a verification URL from a request or token. Overrides skip
      // the SDK's URL parser, so explicitly require HTTPS before fetching keys.
      const jwks = new URL(`${authEnv.url.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)
      if (jwks.protocol !== 'https:' || jwks.username || jwks.password || jwks.search || jwks.hash) throw new Error('Invalid JWKS URL')
      authEnv.jwks = jwks
    } catch {
      return NextResponse.json({ error: 'Daily Brief authentication is unavailable.' }, { status: 503 })
    }
  }
  const { error: authError } = envError
    ? { error: envError }
    : await verifyAuth(req, { auth: 'user', env: authEnv! })
  if (authError) {
    if (authError.status === 500) {
      console.error(`/api/brief: auth misconfigured [${authError.code}] ${authError.message}`)
      return NextResponse.json(
        { error: `Server auth is misconfigured: ${authError.message} (${authError.code})` },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'Sign in to use Daily Brief.' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY on the server to enable Daily Brief.' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 })
  }
  const { mode, question, missions } = (body ?? {}) as {
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

  // Re-narrow on the server rather than trusting the client's shape — the
  // client is expected to send what missionsToBriefContext() produces, but
  // this route never assumes it did.
  const safeMissions: BriefMissionContext[] = missions.map(entry => {
    const r = (entry ?? {}) as Record<string, unknown>
    return {
      title: typeof r.title === 'string' ? r.title : '',
      state: typeof r.state === 'string' ? (r.state as BriefMissionContext['state']) : 'candidate',
      why: typeof r.why === 'string' ? r.why : '',
      finishLine: typeof r.finishLine === 'string' ? r.finishLine : null,
      blocker: typeof r.blocker === 'string' ? r.blocker : null,
      capacityMismatch: Boolean(r.capacityMismatch),
    }
  })
  const safeQuestion = typeof question === 'string' ? question.slice(0, MAX_QUESTION_LENGTH) : undefined
  if (mode === 'question' && !safeQuestion?.trim()) {
    return NextResponse.json({ error: 'A question is required for mode "question".' }, { status: 400 })
  }

  const directive = buildBriefDirective(mode as BriefMode, safeMissions, safeQuestion)

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: DAILY_BRIEF_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: directive }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()

    return NextResponse.json({ text: text || 'No brief text returned.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Daily Brief failed.\n\n${message}` }, { status: 500 })
  }
}

// Narrowly bounded model assistance for one stage only: turning a single
// finish-line clause into a concrete operation, when the deterministic
// engine has genuinely exhausted structural signal (no blocker, no
// evidence requirement, no way to derive an operation from missionLoop
// state alone).
//
// What this route is NOT:
//   - It is not a chat endpoint. One clause in, at most one line out.
//   - It never sees or returns anything the client didn't already have —
//     mission title, finish line, the one unresolved clause, and prior
//     correction reasons for that same mission. No browsing, no other
//     users' data, no fabricated facts.
//   - Its output is a *candidate*, not a decision. The caller runs it
//     through the same `isConcreteMove` gate and the same inhibition
//     pipeline as every deterministic candidate — this route does not
//     get to bypass that.
//   - It is never called to decide whether something is done. Model
//     output never becomes Action, never becomes Evidence.
//
// Mirrors /api/analyze's auth + configured-check shape.

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@supabase/server/core'
import { isConcreteMove } from '@/lib/strategicDelta'

export const runtime = 'nodejs'

const MODEL = 'claude-opus-5'
const MAX_OPERATION_CHARS = 160
const MAX_REQUEST_BYTES = 12 * 1024
const MAX_MISSION_TITLE_CHARS = 500
const MAX_FINISH_LINE_CHARS = 2_000
const MAX_CLAUSE_CHARS = 1_000
const MAX_REJECTED_OPERATIONS = 8
const MAX_CORRECTION_REASON_CHARS = 500

const SYSTEM_PROMPT = `You turn one unresolved sentence from a person's own finish line into ONE concrete action they can perform right now to test or advance it.

Rules:
- Output exactly one sentence. No preamble, no numbering, no quotes around it.
- Name a real, physical or observable action: an executable verb plus a specific object. "Reload the app and check whether X survived", "Call the reviewer and ask Y", "Open the feature and confirm Z" are the right shape.
- Never restate the mission or the finish line back. Never use only "verify", "check", "confirm", or "review" as your entire new content — those words are fine alongside a real object, never alone.
- Never invent facts you were not given. If you cannot ground a concrete action in what you were told, output exactly: NONE
- Do not explain your reasoning. Output only the action, or NONE.`

interface RequestBody {
  missionTitle?: unknown
  finishLine?: unknown
  clause?: unknown
  rejectedOperations?: unknown
}

interface RejectedOperation {
  operation: string
  reason: string
}

function isLocalDevelopment(req: NextRequest): boolean {
  return process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1', '::1'].includes(req.nextUrl.hostname)
}

async function verifyOwner(req: NextRequest): Promise<NextResponse | null> {
  const { data: auth, error: authError } = await verifyAuth(req, { auth: 'user' })
  if (authError) {
    if (authError.status === 500) {
      console.error(`/api/delta-operation auth misconfigured [${authError.code}]`)
      return NextResponse.json(
        { error: 'Server authentication is misconfigured.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'Sign in to use model-assisted candidates.' }, { status: 401 })
  }

  const userId = auth?.userClaims?.id
  const allowedUserId = process.env.DELTA_OPERATION_ALLOWED_USER_ID
  if (!isLocalDevelopment(req) && (!allowedUserId || userId !== allowedUserId)) {
    return NextResponse.json({ error: 'Model-assisted candidates are not enabled for this account.' }, { status: 403 })
  }

  return null
}

function boundedString(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= maxChars ? trimmed : null
}

function parseRejectedOperations(value: unknown): RejectedOperation[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_REJECTED_OPERATIONS) return null
  const parsed: RejectedOperation[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const record = item as { operation?: unknown; reason?: unknown }
    const operation = boundedString(record.operation, MAX_OPERATION_CHARS)
    const reason = boundedString(record.reason, MAX_CORRECTION_REASON_CHARS)
    if (!operation || !reason) return null
    parsed.push({ operation, reason })
  }
  return parsed
}

export async function GET(req: NextRequest) {
  const authResponse = await verifyOwner(req)
  if (authResponse) return authResponse
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(req: NextRequest) {
  const authResponse = await verifyOwner(req)
  if (authResponse) return authResponse
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY on the server to enable model-assisted candidates.' },
      { status: 503 },
    )
  }

  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
  }

  let body: RequestBody
  try {
    const rawBody = await req.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
    }
    body = JSON.parse(rawBody) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const missionTitle = boundedString(body.missionTitle, MAX_MISSION_TITLE_CHARS)
  const finishLine = boundedString(body.finishLine, MAX_FINISH_LINE_CHARS)
  const clause = boundedString(body.clause, MAX_CLAUSE_CHARS)
  const rejectedOperations = parseRejectedOperations(body.rejectedOperations)

  if (!missionTitle || !finishLine || !clause || !rejectedOperations) {
    return NextResponse.json(
      { error: 'Request fields are missing, invalid, or too large.' },
      { status: 400 },
    )
  }

  const userText = [
    `Mission: ${missionTitle}`,
    `Full finish line: ${finishLine}`,
    `The one unresolved part to turn into an action: ${clause}`,
    rejectedOperations.length > 0
      ? `Operations already rejected for this unresolved target. Do not repeat them:\n${rejectedOperations.map(({ operation, reason }) => `- ${operation} (reason: ${reason})`).join('\n')}`
      : null,
  ].filter((x): x is string => x !== null).join('\n\n')

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }],
    })

    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join(' ')
      .trim()

    if (!raw || raw.toUpperCase() === 'NONE' || raw.length > MAX_OPERATION_CHARS) {
      return NextResponse.json({ operation: null })
    }

    // Sanity check here; the authoritative gate is the same isConcreteMove
    // the deterministic candidates run through once this re-enters the
    // engine's inhibition stage. This just avoids returning obvious junk.
    if (!isConcreteMove(raw, { title: missionTitle, finishLine })) {
      return NextResponse.json({ operation: null })
    }

    return NextResponse.json({ operation: raw })
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : 'unknown'
    console.error(`/api/delta-operation model call failed [${status}]`)
    return NextResponse.json({ error: 'Model operation generation failed.' }, { status: 502 })
  }
}

import { operationsEquivalent } from '@/lib/operationEquivalence'
import { loadLearnedContext, MISSION_UUID } from '@/lib/learnedContextServer'
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
import { deltaOwner } from '@/lib/supabase/deltaAuth'
import { isConcreteMove } from '@/lib/strategicDelta'
import { DELTA_OPERATION_SYSTEM_PROMPT } from '@/lib/cognitiveDoctrine'

export const runtime = 'nodejs'

const MODEL = 'claude-opus-5'
const MAX_OPERATION_CHARS = 160
const MAX_REQUEST_BYTES = 12 * 1024
const MAX_MISSION_TITLE_CHARS = 500
const MAX_FINISH_LINE_CHARS = 2_000
const MAX_CLAUSE_CHARS = 1_000
const MAX_REJECTED_OPERATIONS = 8
const MAX_CORRECTION_REASON_CHARS = 500

interface RequestBody {
  missionId?: unknown
  missionTitle?: unknown
  finishLine?: unknown
  clause?: unknown
  rejectedOperations?: unknown
}

interface RejectedOperation {
  operation: string
  reason: string
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
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
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

  if (body.missionId !== undefined && (typeof body.missionId !== 'string' || !MISSION_UUID.test(body.missionId))) return NextResponse.json({ error: 'Invalid mission scope.' }, { status: 400 })

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
    const learnedContext = await loadLearnedContext(owner.url, req.headers.get('Authorization') ?? '', owner.userId, typeof body.missionId === 'string' ? [body.missionId] : [])
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: DELTA_OPERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `${userText}\n\n${learnedContext}` }],
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
    if (rejectedOperations.some(item => operationsEquivalent(item.operation, raw))) return NextResponse.json({ operation: null })
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

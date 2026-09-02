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

const SYSTEM_PROMPT = `You turn one unresolved sentence from a person's own finish line into ONE concrete action they can perform right now to test or advance it.

Rules:
- Output exactly one sentence. No preamble, no numbering, no quotes around it.
- Name a real, physical or observable action: an executable verb plus a specific object. "Reload the app and check whether X survived", "Call the reviewer and ask Y", "Open the feature and confirm Z" are the right shape.
- Never restate the mission or the finish line back. Never use only "verify", "check", "confirm", or "review" as your entire new content — those words are fine alongside a real object, never alone.
- Never invent facts you were not given. If you cannot ground a concrete action in what you were told, output exactly: NONE
- Do not explain your reasoning. Output only the action, or NONE.`

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

interface RequestBody {
  missionTitle?: unknown
  finishLine?: unknown
  clause?: unknown
  priorCorrections?: unknown
}

export async function POST(req: NextRequest) {
  const { error: authError } = await verifyAuth(req, { auth: 'user' })
  if (authError) {
    if (authError.status === 500) {
      console.error(`/api/delta-operation: auth misconfigured [${authError.code}] ${authError.message}`)
      return NextResponse.json(
        { error: `Server auth is misconfigured: ${authError.message} (${authError.code})` },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'Sign in to use model-assisted candidates.' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY on the server to enable model-assisted candidates.' },
      { status: 503 },
    )
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const missionTitle = typeof body.missionTitle === 'string' ? body.missionTitle.trim() : ''
  const finishLine = typeof body.finishLine === 'string' ? body.finishLine.trim() : ''
  const clause = typeof body.clause === 'string' ? body.clause.trim() : ''
  const priorCorrections = Array.isArray(body.priorCorrections)
    ? body.priorCorrections.filter((c): c is string => typeof c === 'string').slice(0, 10)
    : []

  if (!missionTitle || !finishLine || !clause) {
    return NextResponse.json(
      { error: 'missionTitle, finishLine, and clause are all required.' },
      { status: 400 },
    )
  }

  const userText = [
    `Mission: ${missionTitle}`,
    `Full finish line: ${finishLine}`,
    `The one unresolved part to turn into an action: ${clause}`,
    priorCorrections.length > 0
      ? `Actions already rejected by this person, do not repeat their shape:\n${priorCorrections.map(r => `- ${r}`).join('\n')}`
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
    const message = err instanceof Error ? err.message : String(err)
    console.error(`/api/delta-operation: model call failed: ${message}`)
    return NextResponse.json({ operation: null })
  }
}

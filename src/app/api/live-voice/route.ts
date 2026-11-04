import { NextRequest, NextResponse } from 'next/server'
import { deltaOwner } from '@/lib/supabase/deltaAuth'

export const runtime = 'nodejs'
export const maxDuration = 30

const LIVE_URL = 'https://api.openai.com/v1/live/sessions'
const LIVE_INSTRUCTIONS = [
  'You are the voice interface for Legacy Codex, not a separate assistant or a demo business.',
  'Speak naturally, briefly and allow the user to interrupt or revise a request at any time.',
  'Delegate whenever the user asks about missions, project history, real records, evidence, lessons, relationships, decisions or next actions.',
  'The client delegation backend is the existing Legacy Codex intelligence system. It chooses the reasoning provider; do not claim that you did the backend research yourself.',
  'Treat spoken and displayed dialogue as unverified until the backend returns real records or analysis.',
  'Never invent mission state, events, evidence, files, actions or a saved outcome.',
  'No voice response saves or modifies project records. When the user wants to save a proposed next action, explain that the existing Save as my next action control requires their explicit confirmation.',
  'If backend information is unavailable, say so directly. Do not treat a suggestion as completed work.',
].join(' ')

/** A no-cost authorization/configuration preflight before asking for microphone access. */
export async function GET(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI live voice is not configured on this server.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    })
  }
  return NextResponse.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } })
}

/** Owner-gated server-side SDP exchange. The OpenAI project key never reaches the browser. */
export async function POST(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OpenAI live voice is not configured on this server.' }, { status: 503 })

  let sdp: unknown
  try {
    const raw = await req.text()
    if (Buffer.byteLength(raw) > 128_000) return NextResponse.json({ error: 'Voice offer is too large.' }, { status: 413 })
    sdp = (JSON.parse(raw) as { sdp?: unknown }).sdp
  } catch {
    return NextResponse.json({ error: 'Invalid voice session request.' }, { status: 400 })
  }
  if (typeof sdp !== 'string' || sdp.length < 10 || sdp.length > 100_000 || !sdp.startsWith('v=0')) {
    return NextResponse.json({ error: 'A valid WebRTC offer is required.' }, { status: 400 })
  }

  try {
    const upstream = await fetch(LIVE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: {
          model: 'gpt-live-1',
          instructions: LIVE_INSTRUCTIONS,
          delegation: { type: 'client', acknowledgement_delay_ms: 800 },
          store: false,
        },
        transport: { type: 'webrtc', sdp },
      }),
      signal: AbortSignal.timeout(22_000),
      cache: 'no-store',
    })
    if (!upstream.ok) {
      console.error('GPT-Live session creation failed', { status: upstream.status })
      return NextResponse.json({ error: `OpenAI live voice could not start (HTTP ${upstream.status}).` }, { status: 503 })
    }
    const created = await upstream.json() as { session?: { id?: unknown }; transport?: { type?: unknown; sdp?: unknown } }
    if (typeof created.session?.id !== 'string' || created.transport?.type !== 'webrtc' || typeof created.transport?.sdp !== 'string') {
      return NextResponse.json({ error: 'OpenAI returned an incomplete voice session.' }, { status: 502 })
    }
    return NextResponse.json({ id: created.session.id, sdp: created.transport.sdp }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'OpenAI live voice is unreachable. No project records were changed.' }, { status: 503 })
  }
}

/** Best-effort remote hangup, in addition to closing the browser peer and microphone. */
export async function DELETE(req: NextRequest) {
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  let id: unknown
  try {
    const raw = await req.text()
    if (Buffer.byteLength(raw) > 1024) return NextResponse.json({ error: 'Invalid session identifier.' }, { status: 400 })
    id = (JSON.parse(raw) as { id?: unknown }).id
  } catch {
    return NextResponse.json({ error: 'Invalid session identifier.' }, { status: 400 })
  }
  if (typeof id !== 'string' || !/^live_[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid session identifier.' }, { status: 400 })
  }
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'Voice service is not configured.' }, { status: 503 })
  try {
    const result = await fetch(`${LIVE_URL}/${encodeURIComponent(id)}/hangup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!result.ok && result.status !== 404) return NextResponse.json({ error: 'Could not confirm remote hangup.' }, { status: 502 })
    return NextResponse.json({ closed: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not confirm remote hangup.' }, { status: 503 })
  }
}

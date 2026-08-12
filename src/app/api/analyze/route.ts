import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@supabase/server/core'

export const runtime = 'nodejs'

const MODEL = 'claude-opus-5'
// Vercel Serverless Functions reject request bodies over 4.5 MB with an opaque
// 413 before this handler runs, so the ceiling is a platform limit, not a
// preference. Budget under it to leave room for multipart framing and the
// instruction field, and measure the whole upload — the limit applies to the
// combined body, not to each file individually.
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const DEFAULT_INSTRUCTION =
  'Analyze the attached artifacts and return: 1) concise summary, 2) key signals, 3) risks, 4) action checklist, 5) next single step.'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(req: NextRequest) {
  const { error: authError } = await verifyAuth(req, { auth: 'user' })
  if (authError) {
    // authError.status is 500 only for genuine server misconfiguration (e.g. a
    // missing SUPABASE_URL/SUPABASE_JWKS_URL env var causing @supabase/server's
    // resolveEnv() to fail before it even inspects the request's credentials —
    // see .agents/skills/supabase-server/SKILL.md). A missing or invalid JWT is
    // always a 401 with code INVALID_CREDENTIALS. Don't tell the caller to sign
    // in when the real problem is server config — log it and say so honestly.
    if (authError.status === 500) {
      console.error(`/api/analyze: auth misconfigured [${authError.code}] ${authError.message}`)
      return NextResponse.json(
        { error: `Server auth is misconfigured: ${authError.message} (${authError.code})` },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: 'Sign in to use artifact analysis.' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY on the server to enable artifact analysis.' },
      { status: 503 },
    )
  }

  const formData = await req.formData()
  const instruction = String(formData.get('instruction') ?? '').trim()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'Attach at least one file before running artifact analysis.' },
      { status: 400 },
    )
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: `Attachments too large: ${formatMb(totalBytes)} total. Max ${formatMb(MAX_TOTAL_BYTES)} per request.` },
      { status: 413 },
    )
  }

  const content: Anthropic.ContentBlockParam[] = []
  for (const file of files) {
    const block = await fileToBlock(file)
    if (!block) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.name}. Accepted: pdf, txt, md, csv, json, images.` },
        { status: 400 },
      )
    }
    content.push(block)
  }
  content.push({ type: 'text', text: instruction || DEFAULT_INSTRUCTION })

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()

    return NextResponse.json({ text: text || 'No analysis text returned.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Analysis failed.\n\n${message}` }, { status: 500 })
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fileToBlock(file: File): Promise<Anthropic.ContentBlockParam | null> {
  const name = file.name.toLowerCase()
  const mime = file.type

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  }

  if (IMAGE_MIME_TYPES.has(mime)) {
    const data = Buffer.from(await file.arrayBuffer()).toString('base64')
    return {
      type: 'image',
      source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
    }
  }

  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json')) {
    const text = await file.text()
    return { type: 'text', text: `[FILE: ${file.name}]\n${text}` }
  }

  return null
}

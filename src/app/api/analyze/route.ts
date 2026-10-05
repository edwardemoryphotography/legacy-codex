import { loadLearnedContext, MISSION_UUID } from '@/lib/learnedContextServer'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { ARTIFACT_ANALYSIS_DEFAULT_INSTRUCTION, ARTIFACT_ANALYSIS_SYSTEM_PROMPT } from '@/lib/cognitiveDoctrine'
import { deltaOwner } from '@/lib/supabase/deltaAuth'

export const runtime = 'nodejs'

const MODEL = 'claude-opus-5'
// Vercel Serverless Functions reject request bodies over 4.5 MB with an opaque
// 413 before this handler runs, so the ceiling is a platform limit, not a
// preference. Budget under it to leave room for multipart framing and the
// instruction field, and measure the whole upload — the limit applies to the
// combined body, not to each file individually.
const MAX_TOTAL_BYTES = 4 * 1024 * 1024

// Typed text that reaches the prompt (the directive and each attachment's
// filename label) is clamped, not rejected. Attachment bytes are bounded above.
const MAX_TEXT_FIELD_LENGTH = 400

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(req: NextRequest) {
  // Every visitor is signed in as an anonymous Supabase guest, so "has a
  // user" is not a boundary for a paid model call. Same owner gate as the
  // Strategic Delta routes (@/lib/supabase/deltaAuth): 500 only for genuine
  // server auth misconfiguration, 401 for a missing/invalid session, 403 for
  // any account that is not the configured owner — all before any model call.
  const owner = await deltaOwner(req)
  if ('response' in owner) return owner.response
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY on the server to enable artifact analysis.' },
      { status: 503 },
    )
  }

  const formData = await req.formData()
  const instruction = String(formData.get('instruction') ?? '').trim().slice(0, MAX_TEXT_FIELD_LENGTH)
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
    // Binary blocks carry bytes, not the browser's filename. Keep a source
    // label adjacent to every attachment so attribution never has to guess.
    content.push({ type: 'text', text: `Attachment filename: ${JSON.stringify(file.name.slice(0, MAX_TEXT_FIELD_LENGTH))}` })
    content.push(block)
  }
  content.push({ type: 'text', text: instruction || ARTIFACT_ANALYSIS_DEFAULT_INSTRUCTION })

  const scope = formData.get('missionId')
  if (scope !== null && (typeof scope !== 'string' || !MISSION_UUID.test(scope))) return NextResponse.json({ error: 'Invalid mission scope.' }, { status: 400 })
  try {
    const learnedContext = await loadLearnedContext(owner.url, req.headers.get('Authorization') ?? '', owner.userId, typeof formData.get('missionId') === 'string' && formData.get('missionId') ? [String(formData.get('missionId'))] : [])
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: ARTIFACT_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [...content, { type: 'text', text: learnedContext }] }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()

    return NextResponse.json({ text: text || 'No analysis text returned.' })
  } catch {
    console.error('/api/analyze failed [learning-or-provider]')
    return NextResponse.json({ error: 'Analysis unavailable: saved learning or the model could not be read. Retry without replacing your saved work.' }, { status: 503 })
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
    return { type: 'text', text: `[FILE: ${file.name.slice(0, MAX_TEXT_FIELD_LENGTH)}]\n${text}` }
  }

  return null
}

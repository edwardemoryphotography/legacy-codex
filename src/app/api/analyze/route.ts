import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MODEL = 'claude-opus-5'
const MAX_FILE_BYTES = 20 * 1024 * 1024
const DEFAULT_INSTRUCTION =
  'Analyze the attached artifacts and return: 1) concise summary, 2) key signals, 3) risks, 4) action checklist, 5) next single step.'

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
}

export async function POST(req: NextRequest) {
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

  const oversized = files.find(f => f.size > MAX_FILE_BYTES)
  if (oversized) {
    return NextResponse.json(
      { error: `File too large: ${oversized.name}. Max 20 MB per file.` },
      { status: 400 },
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

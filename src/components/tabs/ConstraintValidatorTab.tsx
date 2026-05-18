'use client'

import { useState, useRef } from 'react'
import { CONSTRAINT_TERMS, CANONICAL_PRINCIPLES } from '@/data/principles'
import {
  SectionTitle, SectionSubtitle,
  FieldLabel, Textarea, ActionBtn, HelperLine,
} from '@/components/ui'

interface EvalResult {
  name: string
  pass: boolean
  reason: string
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some(t => text.includes(t))
}

function evaluate(task: string): EvalResult[] {
  const t = task.toLowerCase()
  const mentionsArtifact    = containsAny(t, CONSTRAINT_TERMS.artifact)
  const mentionsResilience  = containsAny(t, CONSTRAINT_TERMS.resilience)
  const mentionsGoverning   = containsAny(t, CONSTRAINT_TERMS.governing)
  const mentionsExisting    = containsAny(t, CONSTRAINT_TERMS.existingInfra)
  const proposesNewTool     = containsAny(t, CONSTRAINT_TERMS.newTool)

  return [
    {
      name: CANONICAL_PRINCIPLES[0].name,
      pass: mentionsArtifact,
      reason: mentionsArtifact
        ? 'Concrete artifact/system language is present.'
        : 'No concrete artifact or system deliverable is named.',
    },
    {
      name: CANONICAL_PRINCIPLES[1].name,
      pass: mentionsResilience,
      reason: mentionsResilience
        ? 'Resumption continuity cues are present (log/checkpoint/blocker).'
        : 'No interruption-safe resumption cue is present.',
    },
    {
      name: CANONICAL_PRINCIPLES[2].name,
      pass: mentionsGoverning,
      reason: mentionsGoverning
        ? 'Task references system/protocol/constraint authority.'
        : 'Task does not reference system authority constraints.',
    },
    {
      name: CANONICAL_PRINCIPLES[3].name,
      pass: mentionsExisting && !proposesNewTool,
      reason: mentionsExisting && !proposesNewTool
        ? 'Task favors modifying existing infrastructure.'
        : 'Task does not clearly prefer existing infrastructure.',
    },
  ]
}

// ─── Artifact Analyzer using Gemini ───────────────────────────
const GEMINI_ENDPOINT =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`
    : null

const MAX_FILE_BYTES = 20 * 1024 * 1024

export default function ConstraintValidatorTab() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<EvalResult[] | null>(null)

  // Artifact analyzer state
  const [instruction, setInstruction] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [analysisOutput, setAnalysisOutput] = useState('')
  const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validate = () => {
    const t = input.trim()
    if (!t) {
      setResults([])
      return
    }
    setResults(evaluate(t))
  }

  const allPass = results !== null && results.length > 0 && results.every(r => r.pass)
  const anyResult = results !== null

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const analyze = async () => {
    if (!files.length) return
    if (!GEMINI_ENDPOINT) {
      setAnalysisOutput('Set NEXT_PUBLIC_GEMINI_API_KEY environment variable to enable artifact analysis.')
      setAnalyzeStatus('error')
      return
    }
    const oversized = files.find(f => f.size > MAX_FILE_BYTES)
    if (oversized) {
      setAnalysisOutput(`File too large: ${oversized.name}. Max 20 MB per file.`)
      setAnalyzeStatus('error')
      return
    }
    setAnalyzeStatus('running')
    setAnalysisOutput('Running analysis…')

    try {
      const parts: unknown[] = [
        { text: instruction.trim() || 'Analyze the attached artifacts and return: 1) concise summary, 2) key signals, 3) risks, 4) action checklist, 5) next single step.' },
      ]
      for (const file of files) {
        parts.push(await fileToPart(file))
      }
      const res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
      const text = (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? '')
        .join('\n')
        .trim()
      setAnalysisOutput(text || 'No analysis text returned.')
      setAnalyzeStatus('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAnalysisOutput(`Analysis failed.\n\n${msg}`)
      setAnalyzeStatus('error')
    }
  }

  return (
    <section>
      <SectionTitle>Constraint Validator</SectionTitle>
      <SectionSubtitle>
        Run a task against all 4 Canonical Principles with pass/fail reasoning.
      </SectionSubtitle>

      <div className="mb-3">
        <FieldLabel htmlFor="constraintInput">
          Paste any task, idea, or prompt here
        </FieldLabel>
        <Textarea
          id="constraintInput"
          value={input}
          onChange={setInput}
          placeholder="Paste task text for validation."
        />
      </div>

      <div className="flex gap-2 mb-3">
        <ActionBtn onClick={validate}>Validate Against Codex</ActionBtn>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="grid gap-2 mb-3">
          {results.map(r => (
            <div
              key={r.name}
              className="px-3 py-2.5 rounded-[10px] text-sm grid gap-1"
              style={{
                border: `1px solid ${r.pass ? 'var(--success)' : 'var(--error)'}`,
                background: r.pass ? 'var(--success-soft)' : 'var(--error-soft)',
                color: r.pass ? '#c4f7de' : '#ffd0d5',
              }}
            >
              <strong>
                {r.name}: {r.pass ? 'PASS ✓' : 'FAIL ✗'}
              </strong>
              <span>{r.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className="px-3 py-2.5 rounded-[10px] text-xs font-black tracking-wide uppercase mb-6"
        style={{
          border: !anyResult
            ? '1px solid var(--line)'
            : allPass
            ? '1px solid var(--success)'
            : '1px solid var(--error)',
          color: !anyResult ? 'var(--text-dim)' : allPass ? 'var(--success)' : 'var(--error)',
          background: !anyResult
            ? 'var(--surface)'
            : allPass
            ? 'var(--success-soft)'
            : 'var(--error-soft)',
        }}
      >
        {!anyResult && 'No validation run yet.'}
        {anyResult && (allPass ? 'CODEX-ALIGNED' : 'CODEX-VIOLATION')}
      </div>

      {/* ─── Artifact Analyzer ────────────────────────────────── */}
      <div
        className="p-4 rounded-codex mt-4"
        style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
      >
        <h3 className="font-bold mb-1" style={{ fontSize: '1.05rem' }}>
          Artifact Analyzer
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-soft)' }}>
          Upload files and generate a structured analysis via Gemini.
        </p>

        <div className="mb-3">
          <FieldLabel htmlFor="artifactInstruction">Analysis directive (optional)</FieldLabel>
          <input
            id="artifactInstruction"
            type="text"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="Example: Summarize key actions, risks, and next steps."
            style={{
              width: '100%',
              border: '1px solid var(--line-strong)',
              borderRadius: 10,
              background: '#0f0f18',
              color: 'var(--text)',
              font: 'inherit',
              padding: '11px 12px',
              minHeight: 44,
            }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,image/*,video/*"
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />

        <div className="flex flex-wrap gap-2 mb-3">
          <ActionBtn onClick={() => fileInputRef.current?.click()}>Select Files</ActionBtn>
          <ActionBtn onClick={analyze} disabled={analyzeStatus === 'running' || files.length === 0}>
            {analyzeStatus === 'running' ? 'Analyzing…' : 'Analyze Files'}
          </ActionBtn>
          <ActionBtn variant="secondary" onClick={() => { setFiles([]); setAnalysisOutput(''); setAnalyzeStatus('idle') }}>
            Clear
          </ActionBtn>
        </div>

        {files.length > 0 && (
          <div className="grid gap-1.5 mb-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-[10px] text-xs"
                style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)', color: 'var(--text-soft)' }}
              >
                <span className="truncate flex-1">{f.name} ({formatBytes(f.size)})</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={{
                    border: '1px solid var(--line-strong)',
                    background: 'transparent',
                    color: 'var(--text-dim)',
                    borderRadius: 8,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <HelperLine variant={analyzeStatus === 'error' ? 'error' : analyzeStatus === 'done' ? 'success' : undefined}>
          {files.length === 0 ? 'No files selected.' : `${files.length} file(s) selected · ${formatBytes(files.reduce((s, f) => s + f.size, 0))} total`}
        </HelperLine>

        {analysisOutput && (
          <pre
            className="mt-3 p-3 rounded-codex text-sm whitespace-pre-wrap break-words"
            style={{
              border: '1px solid var(--line)',
              background: '#0f0f18',
              color: 'var(--text)',
              minHeight: 140,
            }}
          >
            {analysisOutput}
          </pre>
        )}
      </div>
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fileToPart(file: File): Promise<unknown> {
  const mime = file.type || guessMime(file.name)
  if (isTextLike(mime, file.name)) {
    const text = await file.text()
    return { text: `[FILE: ${file.name} | MIME: ${mime}]\n${text}` }
  }
  const base64 = await toBase64(file)
  return { inlineData: { mimeType: mime, data: base64 } }
}

function guessMime(name: string): string {
  const n = name.toLowerCase()
  if (n.endsWith('.pdf'))  return 'application/pdf'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.txt'))  return 'text/plain'
  if (n.endsWith('.md'))   return 'text/markdown'
  if (n.endsWith('.csv'))  return 'text/csv'
  if (n.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

function isTextLike(mime: string, name: string): boolean {
  const n = name.toLowerCase()
  return mime.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.csv') || n.endsWith('.json')
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const res = (e.target?.result as string) ?? ''
      const comma = res.indexOf(',')
      resolve(comma === -1 ? '' : res.slice(comma + 1))
    }
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

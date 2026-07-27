'use client'

import { useRef, useState } from 'react'
import { CONSTRAINT_TERMS, CANONICAL_PRINCIPLES } from '@/data/principles'
import {
  SectionTitle,
  SectionSubtitle,
  FieldLabel,
  Textarea,
  ActionBtn,
  HelperLine,
} from '@/components/ui'

interface EvalResult {
  name: string
  pass: boolean
  reason: string
  fix: string
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some(t => text.includes(t))
}

function matchedTerms(text: string, terms: string[]): string[] {
  return terms.filter(term => text.includes(term))
}

function describeTerms(terms: string[]): string {
  return terms.length ? terms.join(', ') : 'none'
}

function evaluate(task: string): EvalResult[] {
  const t = task.toLowerCase()
  const mentionsArtifact = containsAny(t, CONSTRAINT_TERMS.artifact)
  const mentionsResilience = containsAny(t, CONSTRAINT_TERMS.resilience)
  const mentionsGoverning = containsAny(t, CONSTRAINT_TERMS.governing)
  const mentionsExisting = containsAny(t, CONSTRAINT_TERMS.existingInfra)
  const proposesNewTool = containsAny(t, CONSTRAINT_TERMS.newTool)

  return [
    {
      name: CANONICAL_PRINCIPLES[0].name,
      pass: mentionsArtifact,
      reason: mentionsArtifact
        ? 'Concrete artifact/system language is present.'
        : 'No concrete artifact or system deliverable is named.',
      fix: mentionsArtifact
        ? 'Keep the artifact target explicit and add an acceptance check.'
        : 'Name a file, repo, commit, deploy target, dashboard, or export.',
    },
    {
      name: CANONICAL_PRINCIPLES[1].name,
      pass: mentionsResilience,
      reason: mentionsResilience
        ? 'Resumption continuity cues are present (log/checkpoint/blocker).'
        : 'No interruption-safe resumption cue is present.',
      fix: mentionsResilience
        ? 'Keep the next action visible for the next operator.'
        : 'Add a blocker, checkpoint, transcript, or next action so the work can resume cleanly.',
    },
    {
      name: CANONICAL_PRINCIPLES[2].name,
      pass: mentionsGoverning,
      reason: mentionsGoverning
        ? 'Task references system/protocol/constraint authority.'
        : 'Task does not reference system authority constraints.',
      fix: mentionsGoverning
        ? 'Keep the governing rule explicit and non-optional.'
        : 'Reference the system, protocol, policy, or constraint that governs the task.',
    },
    {
      name: CANONICAL_PRINCIPLES[3].name,
      pass: mentionsExisting && !proposesNewTool,
      reason: mentionsExisting && !proposesNewTool
        ? 'Task favors modifying existing infrastructure.'
        : 'Task does not clearly prefer existing infrastructure.',
      fix: mentionsExisting && !proposesNewTool
        ? 'Stay within the current stack and keep the change small.'
        : proposesNewTool
        ? 'Remove the new-tool proposal and restate the work in the current repo or stack.'
        : 'State what current file, flow, or repo path should be modified instead of inventing a new tool.',
    },
  ]
}

const GEMINI_ENDPOINT =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`
    : null

const MAX_FILE_BYTES = 20 * 1024 * 1024
const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.txt,.md,.csv,.json,image/*,video/*'

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

  const passedCount = results?.filter(r => r.pass).length ?? 0
  const failedResults = results?.filter(r => !r.pass) ?? []
  const anyResult = results !== null
  const noTaskSubmitted = anyResult && results.length === 0
  const allPass = anyResult && results.length > 0 && failedResults.length === 0

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const analysisEnabled = Boolean(GEMINI_ENDPOINT)
  const analysisHelperText = !analysisEnabled
    ? 'Artifact analysis is disabled until NEXT_PUBLIC_GEMINI_API_KEY is set. Validation still works locally.'
    : files.length === 0
    ? 'No files selected yet. Upload one or more real artifacts to enable analysis.'
    : analyzeStatus === 'running'
    ? `Analyzing ${files.length} file(s)…`
    : `${files.length} file(s) selected · ${formatBytes(totalBytes)} total`

  const analyze = async () => {
    if (!files.length) {
      setAnalysisOutput('Attach at least one file before running artifact analysis.')
      setAnalyzeStatus('error')
      return
    }
    if (!GEMINI_ENDPOINT) {
      setAnalysisOutput('Set NEXT_PUBLIC_GEMINI_API_KEY to enable artifact analysis.')
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
        {
          text:
            instruction.trim() ||
            'Analyze the attached artifacts and return: 1) concise summary, 2) key signals, 3) risks, 4) action checklist, 5) next single step.',
        },
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
        Run a task against all 4 Canonical Principles with pass/fail reasoning and operator fixes.
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
              <span style={{ color: r.pass ? 'var(--success)' : 'var(--amber)' }}>
                Fix: {r.fix}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="px-3 py-2.5 rounded-[10px] text-xs font-black tracking-wide uppercase mb-2"
        style={{
          border: !anyResult
            ? '1px solid var(--line)'
            : noTaskSubmitted
            ? '1px solid var(--amber)'
            : allPass
            ? '1px solid var(--success)'
            : '1px solid var(--error)',
          color: !anyResult
            ? 'var(--text-dim)'
            : noTaskSubmitted
            ? 'var(--amber)'
            : allPass
            ? 'var(--success)'
            : 'var(--error)',
          background: !anyResult
            ? 'var(--surface)'
            : noTaskSubmitted
            ? 'var(--amber-soft)'
            : allPass
            ? 'var(--success-soft)'
            : 'var(--error-soft)',
        }}
      >
        {!anyResult && 'No validation run yet.'}
        {noTaskSubmitted && 'Task required — paste one sentence before validating.'}
        {allPass && 'CODEX-ALIGNED'}
        {anyResult && !noTaskSubmitted && !allPass && `CODEX-VIOLATION · ${passedCount}/4 pass`}
      </div>

      {anyResult && !allPass && !noTaskSubmitted && (
        <p className="mb-5 text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
          Next move: tighten {failedResults.map(r => r.name).join(', ')} before you hand this off.
        </p>
      )}

      {/* ─── Artifact Analyzer ────────────────────────────────── */}
      <div
        className="p-4 rounded-codex mt-4"
        style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
      >
        <h3 className="font-bold mb-1" style={{ fontSize: '1.05rem' }}>
          Artifact Analyzer
        </h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-soft)' }}>
          Upload real files and generate a structured analysis via Gemini. The directive field is optional and becomes the prompt.
        </p>

        <div
          className="mb-4 rounded-codex p-3"
          style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}
        >
          <div className="text-xs font-black uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--text-dim)' }}>
            Analysis guidance
          </div>
          <ul className="grid gap-1.5 text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
            <li>{analysisEnabled ? 'Live Gemini analysis is enabled.' : 'Live analysis is disabled until NEXT_PUBLIC_GEMINI_API_KEY is set.'}</li>
            <li>Accepted inputs: pdf, doc, docx, txt, md, csv, json, images, and video.</li>
            <li>Max file size: 20 MB per file.</li>
            <li>Validation stays local; analysis only runs when files and an API key are present.</li>
          </ul>
        </div>

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
          accept={ACCEPTED_FILE_TYPES}
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
          {analysisHelperText}
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
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.txt')) return 'text/plain'
  if (n.endsWith('.md')) return 'text/markdown'
  if (n.endsWith('.csv')) return 'text/csv'
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

'use client'

import { useState } from 'react'
import { SPRINT_TERMS, CANONICAL_PRINCIPLES } from '@/data/principles'
import {
  SectionTitle, SectionSubtitle,
  FieldLabel, Input, Select, ActionBtn,
} from '@/components/ui'

type Result = { linked: boolean; reason: string } | null

function containsAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term))
}

export default function SprintLinkerTab() {
  const [task, setTask] = useState('')
  const [principle, setPrinciple] = useState(CANONICAL_PRINCIPLES[0].name)
  const [result, setResult] = useState<Result>(null)

  const validate = () => {
    const t = task.trim()
    if (!t) {
      setResult({ linked: false, reason: 'task is empty.' })
      return
    }
    const norm = t.toLowerCase()
    const hasArtifact = containsAny(norm, SPRINT_TERMS.artifact)
    const hasMindset = containsAny(norm, SPRINT_TERMS.mindset)

    if (hasArtifact && !hasMindset) {
      setResult({
        linked: true,
        reason: `Artifact/system language detected and no mindset-only language found. Principle: ${principle}.`,
      })
      return
    }
    if (!hasArtifact) {
      setResult({
        linked: false,
        reason: `No artifact/system language detected (${SPRINT_TERMS.artifact.join(', ')}).`,
      })
      return
    }
    setResult({
      linked: false,
      reason: 'Mindset-only language detected.',
    })
  }

  return (
    <section>
      <SectionTitle>Sprint Linker</SectionTitle>
      <SectionSubtitle>
        Validate whether a sprint statement is anchored to artifact/system reality.
      </SectionSubtitle>

      <div className="grid gap-3 mb-3">
        <div>
          <FieldLabel htmlFor="sprintTask">
            Describe your current task in one sentence
          </FieldLabel>
          <Input
            id="sprintTask"
            value={task}
            onChange={setTask}
            placeholder="Example: Commit index.html and publish to GitHub Pages"
          />
        </div>

        <div>
          <FieldLabel htmlFor="sprintPrinciple">Link to Canonical Principle</FieldLabel>
          <Select id="sprintPrinciple" value={principle} onChange={setPrinciple}>
            {CANONICAL_PRINCIPLES.map(p => (
              <option key={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <ActionBtn onClick={validate}>Validate Sprint</ActionBtn>
      </div>

      <ResultBox result={result} />
    </section>
  )
}

function ResultBox({ result }: { result: Result }) {
  if (!result) {
    return (
      <div
        className="p-3 rounded-codex text-sm min-h-[56px]"
        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text-soft)' }}
      >
        No validation run yet.
      </div>
    )
  }

  return (
    <div
      className="p-3 rounded-codex text-sm min-h-[56px]"
      style={{
        border: `1px solid ${result.linked ? 'var(--success)' : 'var(--error)'}`,
        background: result.linked ? 'var(--success-soft)' : 'var(--error-soft)',
        color: result.linked ? '#bff5d8' : '#ffc8cf',
      }}
    >
      <strong>{result.linked ? 'LINKED' : 'ORPHANED'}</strong>
      <br />
      Reason: {result.reason}
    </div>
  )
}

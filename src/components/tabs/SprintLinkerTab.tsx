'use client'

import { useState } from 'react'
import { SPRINT_TERMS, CANONICAL_PRINCIPLES } from '@/data/principles'
import {
  SectionTitle,
  SectionSubtitle,
  FieldLabel,
  Input,
  Select,
  ActionBtn,
} from '@/components/ui'

type Result = {
  linked: boolean
  reason: string
  markdownPlan: string
} | null

function containsAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term))
}

function matchedTerms(text: string, terms: string[]): string[] {
  return terms.filter(term => text.includes(term))
}

function formatList(items: string[]): string {
  return items.length ? items.join(', ') : 'none'
}

function summarizeTask(task: string): string {
  const collapsed = task.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= 120) return collapsed
  return `${collapsed.slice(0, 117)}…`
}

function buildMarkdownPlan({
  task,
  principle,
  linked,
  artifactTerms,
  mindsetTerms,
}: {
  task: string
  principle: string
  linked: boolean
  artifactTerms: string[]
  mindsetTerms: string[]
}): string {
  const summary = summarizeTask(task)
  const artifactHint = artifactTerms[0] ?? 'file, repo, commit, deploy target'
  const mindsetHint = formatList(mindsetTerms)

  if (linked) {
    return [
      `## Sprint plan`,
      `- Task: ${summary}`,
      `- Principle: ${principle}`,
      `- Artifact language detected: ${formatList(artifactTerms)}`,
      `- [ ] Keep the work anchored to the current artifact/system target (${artifactHint}).`,
      `- [ ] Make the smallest shippable change that satisfies ${principle}.`,
      `- [ ] Record the deliverable path, repo, commit, or deploy target before handoff.`,
      `- [ ] Verify the artifact exists after the change lands.`,
    ].join('\n')
  }

  return [
    `## Sprint rescue plan`,
    `- Task: ${summary || 'Describe the work in one concrete sentence.'}`,
    `- Principle: ${principle}`,
    `- Artifact language detected: ${formatList(artifactTerms)}`,
    `- Mindset language detected: ${mindsetHint}`,
    `- [ ] Rewrite the task so it names a tangible artifact: file, repo, commit, deploy, dashboard, build, or export.`,
    `- [ ] Remove mindset-only language (${mindsetHint}).`,
    `- [ ] Tie the work to ${principle} with a concrete deliverable.`,
    `- [ ] Add a verification step that proves the artifact exists.`,
  ].join('\n')
}

function buildReason({
  task,
  hasArtifact,
  hasMindset,
  principle,
}: {
  task: string
  hasArtifact: boolean
  hasMindset: boolean
  principle: string
}): string {
  const summary = summarizeTask(task)
  if (!summary) return 'Task is empty.'
  if (hasArtifact && !hasMindset) {
    return `Artifact/system language detected. Principle linked: ${principle}.`
  }
  if (!hasArtifact) {
    return `No artifact/system language detected in: ${formatList(matchedTerms(task.toLowerCase(), SPRINT_TERMS.artifact))}.`
  }
  if (hasMindset) {
    return `Mindset language detected alongside artifact terms: ${formatList(matchedTerms(task.toLowerCase(), SPRINT_TERMS.mindset))}.`
  }
  return 'Task needs a concrete artifact target.'
}

export default function SprintLinkerTab() {
  const [task, setTask] = useState('')
  const [principle, setPrinciple] = useState(CANONICAL_PRINCIPLES[0].name)
  const [result, setResult] = useState<Result>(null)

  const validate = () => {
    const t = task.trim()
    if (!t) {
      setResult({
        linked: false,
        reason: 'Task is empty.',
        markdownPlan: [
          '## Sprint rescue plan',
          '- [ ] Write one sentence that names a file, repo, commit, deploy target, or export.',
          `- [ ] Link it to ${principle}.`,
          '- [ ] Add a verification step before sending the task onward.',
        ].join('\n'),
      })
      return
    }

    const norm = t.toLowerCase()
    const artifactTerms = matchedTerms(norm, SPRINT_TERMS.artifact)
    const mindsetTerms = matchedTerms(norm, SPRINT_TERMS.mindset)
    const hasArtifact = artifactTerms.length > 0
    const hasMindset = mindsetTerms.length > 0
    const linked = hasArtifact && !hasMindset

    setResult({
      linked,
      reason: buildReason({ task: t, hasArtifact, hasMindset, principle }),
      markdownPlan: buildMarkdownPlan({ task: t, principle, linked, artifactTerms, mindsetTerms }),
    })
  }

  return (
    <section>
      <SectionTitle>Sprint Linker</SectionTitle>
      <SectionSubtitle>
        Validate whether a sprint statement is anchored to artifact/system reality, then emit a usable markdown plan.
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
    <div className="grid gap-3">
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

      <div
        className="p-3 rounded-codex text-sm"
        style={{
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          color: 'var(--text-soft)',
        }}
      >
        <div className="text-xs uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--text-dim)' }}>
          Markdown plan
        </div>
        <pre className="whitespace-pre-wrap break-words m-0" style={{ lineHeight: 1.6 }}>
          {result.markdownPlan}
        </pre>
      </div>
    </div>
  )
}

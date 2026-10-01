'use client'

import { useState } from 'react'
import type { ConfirmedLesson, LessonConfirmation, ProjectReview } from '@/lib/projectReview'

export type ConfirmLesson = (lesson: LessonConfirmation) => Promise<boolean>
export type RetireLesson = (lessonId: string) => Promise<boolean>

export default function ProjectLearning({ review, lessons, onConfirm, onRetire }: {
  review: ProjectReview | null
  lessons: ConfirmedLesson[]
  onConfirm?: ConfirmLesson
  onRetire?: RetireLesson
}) {
  return <section className="sd-project-review" aria-label="Lessons carried forward">
    {review && onConfirm && <LessonForm key={review.contextKey} review={review} onConfirm={onConfirm} />}
    {lessons.length > 0 && <>
      <h3>Lessons carried forward — confirmed by you</h3>
      <p>These are operating rules under their stated conditions, not verified facts or proof of completion.</p>
      {lessons.map(lesson => <LessonRecord key={lesson.id} lesson={lesson} onRetire={onRetire} />)}
    </>}
  </section>
}

function LessonForm({ review, onConfirm }: { review: ProjectReview; onConfirm: ConfirmLesson }) {
  const [rule, setRule] = useState(review.lesson?.rule ?? '')
  const [condition, setCondition] = useState(review.lesson?.whenToApply ?? '')
  const [acrossProjects, setAcrossProjects] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const prefix = `lesson-${review.missionId}`
  async function submit() {
    if (busy || !rule.trim() || !condition.trim()) return
    setBusy(true)
    setError('')
    try {
      const saved = await onConfirm({ missionId: review.missionId, contextKey: review.contextKey,
        rule: rule.trim(), whenToApply: condition.trim(), scope: acrossProjects ? 'account' : 'mission' })
      if (!saved) setError('The lesson was not saved. Keep these words and try again.')
    } catch { setError('The lesson was not saved. Keep these words and try again.') }
    finally { setBusy(false) }
  }
  return <details>
    <summary>{review.lesson ? 'A lesson to carry forward — proposed' : 'Teach the system a lesson from this review'}</summary>
    <p>Edit the rule and its limits. Confirming preserves it with this review’s source references; future relevant reviews can use it.</p>
    <label htmlFor={`${prefix}-rule`}>What should the next review remember?</label>
    <textarea id={`${prefix}-rule`} value={rule} maxLength={1_000} rows={3} onChange={event => setRule(event.target.value)} />
    <label htmlFor={`${prefix}-condition`}>When does this apply—and when might it be wrong?</label>
    <textarea id={`${prefix}-condition`} value={condition} maxLength={500} rows={2} onChange={event => setCondition(event.target.value)} />
    <label><input type="checkbox" checked={acrossProjects} onChange={event => setAcrossProjects(event.target.checked)} /> Use this lesson across my projects under these conditions</label>
    <p>Otherwise this rule applies only to this project. Confirming does not change the Goose Cookbook or verify an outcome.</p>
    <button type="button" disabled={busy || !rule.trim() || !condition.trim()} onClick={() => void submit()}>{busy ? 'Preserving lesson…' : 'Confirm and carry forward'}</button>
    {error && <p role="alert">{error}</p>}
  </details>
}

function LessonRecord({ lesson, onRetire }: { lesson: ConfirmedLesson; onRetire?: RetireLesson }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function retire() {
    if (!onRetire || busy) return
    setBusy(true)
    setError('')
    try { if (!await onRetire(lesson.id)) setError('The lesson is still active. Try again.') }
    catch { setError('The lesson is still active. Try again.') }
    finally { setBusy(false) }
  }
  return <details>
    <summary>{lesson.rule}</summary>
    <p>Applies: {lesson.whenToApply}</p>
    <p>Scope: {lesson.scope === 'account' ? 'Across your projects' : 'Its original project only'} · Confirmed {new Date(lesson.confirmedAt).toLocaleDateString()}</p>
    <ul>{lesson.sourceRefs.map(source => <li key={source.id}>{source.label} — {source.status}</li>)}</ul>
    {onRetire && <button type="button" disabled={busy} onClick={() => void retire()}>{busy ? 'Retiring…' : 'Stop using this lesson'}</button>}
    <p>Retiring keeps its history and excludes it from later reviews.</p>
    {error && <p role="alert">{error}</p>}
  </details>
}

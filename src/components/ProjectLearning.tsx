'use client'

import { useState } from 'react'
import { encodeLessonRelay } from '@/lib/lessonRelay'
import type { ConfirmedLesson, LessonConfirmation, ProjectReview } from '@/lib/projectReview'

export type ConfirmLesson = (lesson: LessonConfirmation) => Promise<boolean>
export type RetireLesson = (lessonId: string) => Promise<boolean>

export default function ProjectLearning({ review, lessons, onConfirm, onRetire }: {
  review: ProjectReview | null
  lessons: ConfirmedLesson[]
  onConfirm?: ConfirmLesson
  onRetire?: RetireLesson
}) {
  const bridge = review?.structuralBridge
  const comparison = review?.transferObservation
  const sourceName = (id: string) => review?.sources.find(source => source.id === id)?.label ?? id
  return <section className="sd-project-review" aria-label="Lessons carried forward">
    {(bridge || comparison) && (
      <section className="glass-bridge" aria-label="Cross-project connection evidence">
        <p className="glass-bridge-kicker">BOOMERANG CHECK · NOT VERIFIED</p>
        <h3>Does a lesson carry between projects?</h3>
        {bridge && (
          <dl className="glass-bridge-steps">
            <div><dt>Earlier project · {sourceName(bridge.priorSourceId)}</dt><dd>“{bridge.priorQuote}”</dd></div>
            <div><dt>Current project · {sourceName(bridge.currentSourceId)}</dt><dd>“{bridge.currentQuote}”</dd></div>
            <div><dt>Shared structure · proposed</dt><dd>{bridge.sharedStructure}</dd></div>
            <div><dt>Reasoning bridge · proposed</dt><dd>{bridge.reasoningBridge}</dd></div>
            <div><dt>Practical consequence · proposed</dt><dd>{bridge.application}</dd></div>
            <div><dt>Evidence still required</dt><dd>{bridge.proofRequired}</dd></div>
          </dl>
        )}
        {comparison && (
          <p className="glass-bridge-caveat">
            {comparison.outcome === 'changed_candidate'
              ? 'A different candidate decision was observed in a sequential comparison; that does not prove the confirmed lesson caused it.'
              : 'The comparison has not demonstrated an autonomous change inherited from a confirmed lesson.'}
            {' '}Inheritance remains {comparison.inheritance.toLowerCase()}. No verified transfer signal is emitted.
          </p>
        )}
        {!comparison && <p className="glass-bridge-caveat">This is a proposed connection. No independent transfer comparison is attached.</p>}
      </section>
    )}
    {review && onConfirm && <LessonForm key={review.contextKey} review={review} onConfirm={onConfirm} />}
    {lessons.length > 0 && <>
      <div className="legacy-relay-origin">
        <span className="legacy-relay-eyebrow">THE LEGACY PRINCIPLE</span>
        <h3>My ceiling becomes someone else’s floor.</h3>
        <p>Experience takes time to earn. Understanding can be passed forward. Share a lesson deliberately so another person can start further ahead, then discover what you couldn’t.</p>
        <div className="legacy-relay-steps" aria-hidden="true"><span /><span /><span /><span /></div>
      </div>
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
  const [shareLink, setShareLink] = useState('')
  const [shareMessage, setShareMessage] = useState('')
  async function share() {
    setShareMessage('')
    setShareLink('')
    try {
      const relay = encodeLessonRelay({ rule: lesson.rule, whenToApply: lesson.whenToApply, exceptions: lesson.exceptions })
      const link = new URL('/', window.location.origin)
      link.searchParams.set('relay', relay)
      setShareLink(link.toString())
      if (navigator.share) {
        await navigator.share({ title: 'A lesson to carry forward', url: link.toString() })
        setShareMessage('Shared. Only the lesson, its conditions, and any exceptions were included.')
      } else {
        await navigator.clipboard.writeText(link.toString())
        setShareMessage('Share link copied. Only the lesson, its conditions, and any exceptions were included.')
      }
    } catch {
      setShareMessage('Sharing did not complete. If a link appears below, you can copy it; otherwise the lesson’s full limits could not be prepared.')
    }
  }
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
    {lesson.exceptions && <p>Does not apply: {lesson.exceptions}</p>}
    {lesson.origin === 'incident' && <p>From real incident {lesson.candidateId}. Later use on a different problem: not yet observed.</p>}
    <ul>{lesson.sourceRefs.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label} — {source.status}</li>)}</ul>
    <p>Pass on this rule, when it applies, and any exceptions. Private sources, mission IDs, and account details stay here. Check all shared wording for anything personal before sharing.</p>
    <button type="button" onClick={() => void share()}>Pass this lesson forward</button>
    {shareLink && <label className="legacy-relay-share-link">Shareable link
      <textarea readOnly rows={3} value={shareLink} onFocus={event => event.currentTarget.select()} />
    </label>}
    {shareMessage && <p role="status">{shareMessage}</p>}
    {onRetire && <button type="button" disabled={busy} onClick={() => void retire()}>{busy ? 'Retiring…' : 'Stop using this lesson'}</button>}
    <p>Retiring keeps its history and excludes it from later reviews.</p>
    {error && <p role="alert">{error}</p>}
  </details>
}

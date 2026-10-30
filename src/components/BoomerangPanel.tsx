'use client'

import { useEffect, useRef } from 'react'
import type { ConfirmedLesson, ProjectReview, ProjectReviewRequest } from '@/lib/projectReview'
import { parseStructuralBridge } from '@/lib/structuralTransfer'
import ProjectLearning, { type ConfirmLesson, type RetireLesson } from './ProjectLearning'
import { ActionBtn } from './ui'

/** A view of the existing review/lesson ledger. Opening it never runs or saves work. */
export default function BoomerangPanel({ missionId, missionTitle, finishLine, review, lessons, busy, disabled = false, available, onReview, onConfirm, onRetire, onClose }: {
  missionId: string; missionTitle: string; finishLine: string; review: ProjectReview | null; lessons: ConfirmedLesson[]
  busy: boolean; disabled?: boolean; available: boolean; onReview?: (request: ProjectReviewRequest) => Promise<boolean | void>
  onConfirm?: ConfirmLesson; onRetire?: RetireLesson; onClose: () => void
}) {
  const panel = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = panel.current
    returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : document.querySelector('.orb-trigger:not(:disabled), button[aria-controls="codex-exploration"]')
    node?.focus({ preventScroll: true })
    node?.scrollIntoView?.({ block: 'nearest' })
  }, [])
  function close() {
    onClose()
    if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
  }
  const bridge = review ? parseStructuralBridge(review.structuralBridge, review.sources, missionId) : null
  const prior = review?.sources.find(source => source.id === bridge?.priorSourceId)
  const current = review?.sources.find(source => source.id === bridge?.currentSourceId)
  const observation = review?.transferObservation
  const appliedLesson = lessons.find(lesson => `lesson:${lesson.id}` === bridge?.lessonSourceId)

  return <section id="codex-exploration" className="boomerang-panel" aria-label="Explore this mission" aria-busy={busy} tabIndex={-1} ref={panel}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
    <header><p className="boomerang-eyebrow">Explore this mission</p><h3>What carries forward?</h3><button type="button" className="boomerang-close" onClick={close}>Close exploration</button></header>
    <p><strong>{missionTitle}</strong></p>
    <p>Review this project with its saved context and relevant confirmed lessons. Then choose what to do and what to carry forward.</p>
    {available && onReview ? <ActionBtn disabled={busy || disabled} onClick={() => void onReview({ missionId, finishLine })}>
      {busy ? 'Reviewing project…' : 'Review project'}
    </ActionBtn> : <p className="sd-hint">Project review is unavailable in this account. Your saved work remains available.</p>}
    <p role="status">{busy ? 'Reading your project and checking the proposed move against its sources…'
      : review ? 'Project review ready. Its connections and next move remain proposals.' : ''}</p>
    {!busy && review && <>
      <p className="boomerang-verdict">No verified transfer</p>
      {bridge && prior && current ? <>
        <h4>A possible connection</h4>
        <p className="sd-hint">A model interpretation grounded in these excerpts. Check whether the relationship holds.</p>
        <div className="boomerang-sources">
          <div><h4>Earlier project</h4><p>{prior.label} · {prior.status}</p><blockquote>{bridge.priorQuote}</blockquote></div>
          <div><h4>This project</h4><p>{current.label} · {current.status}</p><blockquote>{bridge.currentQuote}</blockquote></div>
        </div>
        <h4>Shared structure</h4><p>{bridge.sharedStructure}</p>
        <h4>Why the connection may hold</h4><p>{bridge.reasoningBridge}</p>
        <h4>What it changes here — proposed</h4><p>{bridge.application}</p>
        {appliedLesson && <><h4>Lesson used — confirmed by you</h4><p>{appliedLesson.rule}</p><p>Applies when: {appliedLesson.whenToApply}</p></>}
        {!bridge.lessonSourceId && <p className="sd-hint">This connection has no confirmed transferable lesson attached.</p>}
        <h4>What would prove it useful</h4><p>{bridge.proofRequired}</p>
      </> : <p>No source-grounded cross-project connection was returned. You can still review the proposal and decide whether this experience teaches a useful rule.</p>}
      {observation && <details className="boomerang-comparison">
        <summary>Compare the recommendations</summary>
        <p>Both are proposals. A changed recommendation does not establish an improved outcome.</p>
        <p><strong>With confirmed lessons withheld:</strong> {observation.baseline?.operation ?? observation.baseline?.clarification ?? 'No comparison available.'}</p>
        <p><strong>After review:</strong> {observation.after?.operation ?? observation.after?.clarification ?? 'No grounded move returned.'}</p>
        <p>{observation.outcome === 'changed_candidate'
          ? 'The recommendation changed. Critique and model variation could also explain the difference.'
          : observation.outcome === 'no_confirmed_lesson' ? 'No confirmed lesson was available for this comparison.'
          : 'This comparison does not establish that a prior lesson improved the decision.'}</p>
        <p>{observation.human_intervention_required
          ? 'Additional context, clarification, or an incomplete intervention record prevents an unassisted-transfer claim.'
          : 'No intervention was observed in the measured interval. This does not prove autonomous transfer.'}</p>
        <p>Independent outcome evidence and the actual save, reload, and resume workflow still need verification.</p>
      </details>}
      <p className="sd-hint">Use Why this? for the complete review and sources. Accepting the move and saving an action remain your separate choices.</p>
    </>}
    {!review && !busy && <p className="sd-hint">No review is loaded for this project. Nothing has been counted as a learned lesson or successful transfer.</p>}
    {!busy && (review || lessons.length > 0) && <ProjectLearning review={review} lessons={lessons} onConfirm={onConfirm} onRetire={onRetire} />}
  </section>
}

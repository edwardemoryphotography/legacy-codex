/** @vitest-environment jsdom */
// Rendering-contract fixtures only; these are not saved missions or transfer evidence.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { measureTransfer } from '@/lib/structuralTransfer'
import type { ConfirmedLesson, ProjectReview } from '@/lib/projectReview'
import BoomerangPanel from './BoomerangPanel'

const lesson: ConfirmedLesson = { id: 'rule', missionId: 'prior', rule: 'Check the dependency before choosing the next action.',
  whenToApply: 'A proposed action depends on an unresolved earlier decision.', scope: 'account',
  sourceIds: ['prior-note'], sourceRefs: [{ id: 'prior-note', label: 'Earlier correction', status: 'human report' }],
  confirmedAt: '2026-10-01T00:00:00Z', reviewedAt: '2026-10-01T00:00:00Z' }
const review: ProjectReview = {
  missionId: 'current', finishLine: 'The selected work is ready.', operation: 'Check the prerequisite before ordering.', decision: 'act',
  finishWhen: 'The prerequisite has been confirmed.', clarification: null, resumeActionId: null, alternatives: [],
  biggerPicture: '', why: '', overlooked: '', selfCheck: '', unknowns: [], sourceIds: ['current-note'],
  contextKey: 'contract-only', reviewedAt: '2026-10-30T00:00:00Z', cached: false, warnings: [], lesson: null,
  sources: [
    { id: 'prior-note', missionId: 'prior', kind: 'correction', label: 'Earlier correction', status: 'human report', text: 'The order depends on the approved size.' },
    { id: 'current-note', missionId: 'current', kind: 'mission', label: 'Current objective', status: 'human-defined', text: 'The installation depends on the approved layout.' },
    { id: 'lesson:rule', missionId: 'prior', kind: 'lesson', label: lesson.rule, status: 'human-confirmed rule', text: lesson.rule,
      lesson: { scope: 'account', confirmedAt: lesson.confirmedAt } },
  ],
  structuralBridge: { priorSourceId: 'prior-note', currentSourceId: 'current-note', priorQuote: 'The order depends on the approved size.',
    currentQuote: 'The installation depends on the approved layout.', sharedStructure: 'Resolve a dependency before committing downstream work.',
    reasoningBridge: 'Both operations require a prior decision before the next commitment.', application: 'Check the layout before ordering.',
    proofRequired: 'An independent record shows the prerequisite was checked before the order.', lessonSourceId: 'lesson:rule' },
}
const props = { missionId: 'current', missionTitle: 'Current project', finishLine: review.finishLine, review, lessons: [lesson], busy: false, available: true, onClose: vi.fn() }

describe('BoomerangPanel', () => {
  it('shows grounded excerpts, the proposed consequence and the confirmed rule conditions', () => {
    const onConfirm = vi.fn()
    const onRetire = vi.fn()
    render(<BoomerangPanel {...props} onConfirm={onConfirm} onRetire={onRetire} />)
    expect(screen.getByText(review.structuralBridge!.priorQuote)).toBeTruthy()
    expect(screen.getByText(review.structuralBridge!.currentQuote)).toBeTruthy()
    expect(screen.getByText(review.structuralBridge!.proofRequired)).toBeTruthy()
    expect(screen.getByText(`Applies when: ${lesson.whenToApply}`)).toBeTruthy()
    expect(screen.getByText('Stop using this lesson')).toBeTruthy()
    expect(screen.getByText('No verified transfer')).toBeTruthy()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onRetire).not.toHaveBeenCalled()
  })

  it('rejects a bridge with an invented excerpt instead of presenting its story', () => {
    render(<BoomerangPanel {...props} review={{ ...review, structuralBridge: { ...review.structuralBridge!, priorQuote: 'Invented source text' } }} />)
    expect(screen.queryByText('A possible connection')).toBeNull()
    expect(screen.queryByText('Invented source text')).toBeNull()
    expect(screen.queryByText(review.structuralBridge!.sharedStructure)).toBeNull()
    expect(screen.getByText('No verified transfer')).toBeTruthy()
  })

  it('does not label a changed candidate as inherited or improved', () => {
    const baseline = { ...review, operation: 'Order the work before checking the prerequisite.' }
    const observation = measureTransfer({ baseline, after: review, sources: review.sources, lessons: [lesson], missionId: 'current',
      requestContextAdded: false, reviewedAt: review.reviewedAt,
      interventionEvidence: { since: lesson.confirmedAt, eventCount: 0, objectiveUpdated: false } })
    expect(observation.outcome).toBe('changed_candidate')
    render(<BoomerangPanel {...props} review={{ ...review, transferObservation: observation }} />)
    expect(screen.getByText('No verified transfer')).toBeTruthy()
    expect(screen.getByText(/Critique and model variation could also explain/)).toBeTruthy()
    expect(screen.getByText(/Both are proposals/)).toBeTruthy()
  })

  it('shows real pending review feedback and blocks another request until it resolves', () => {
    const onReview = vi.fn()
    render(<BoomerangPanel {...props} busy onReview={onReview} />)
    const button = screen.getByRole('button', { name: 'Reviewing project…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onReview).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('Reading your project')
  })

  it('closes on Escape without treating that as a review or a lesson confirmation', () => {
    const onClose = vi.fn()
    const onReview = vi.fn()
    render(<BoomerangPanel {...props} onClose={onClose} onReview={onReview} />)
    fireEvent.keyDown(screen.getByRole('region', { name: 'Explore this mission' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(onReview).not.toHaveBeenCalled()
  })
})

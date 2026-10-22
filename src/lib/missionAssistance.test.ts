import { describe, expect, it } from 'vitest'
import {
  buildDeterministicAssistance,
  declaredQuantities,
  extractDeadline,
  plannedQuantities,
  quantityConflicts,
  splitPages,
} from './missionAssistance'

describe('splitPages', () => {
  it('always adds up to the declared page total', () => {
    for (let total = 2; total <= 30; total++) {
      for (const weights of [[0.2, 0.2, 0.4, 0.2], [0.15, 0.35, 0.35, 0.15]]) {
        const parts = splitPages(total, weights)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
        expect(parts.every(p => p >= 0.5)).toBe(true)
      }
    }
  })
})

describe('declared vs planned quantities', () => {
  it('reads single amounts and ranges per unit, finish line first', () => {
    expect(declaredQuantities('When I have written 3 pages', 'my last one was 10 pages')).toEqual([
      { unit: 'pages', min: 3, max: 3 },
    ])
    expect(declaredQuantities('3-5 pages and 12 slides')).toEqual([
      { unit: 'pages', min: 3, max: 5 },
      { unit: 'slides', min: 12, max: 12 },
    ])
  })

  it('sums half-page budgets and flags a plan that overshoots', () => {
    const plan = '(~1 page) (~1 page) (~2 pages) (~1 page)'
    expect(plannedQuantities(plan).get('pages')).toBe(5)
    expect(quantityConflicts(plan, [{ unit: 'pages', min: 3, max: 3 }])).toEqual([
      { unit: 'pages', declared: '3', planned: 5 },
    ])
    expect(plannedQuantities('(~½ page) (~1½ pages) (~1 page)').get('pages')).toBe(3)
    expect(quantityConflicts('(~4 pages)', [{ unit: 'pages', min: 3, max: 5 }])).toEqual([])
  })
})

describe('buildDeterministicAssistance', () => {
  it('produces page budgets that match every short and long page target', () => {
    for (let pages = 2; pages <= 12; pages++) {
      for (const note of ['outline the argument', 'I need a topic']) {
        const result = buildDeterministicAssistance({
          title: 'Essay',
          finishLine: `When I have written ${pages} pages`,
          contextNote: note,
        })
        expect(result.constraintCheck.conflicts).toEqual([])
        expect(plannedQuantities(result.workDraft).get('pages')).toBe(pages)
      }
    }
  })

  it('keeps the 20-minute starting steps', () => {
    const result = buildDeterministicAssistance({ title: 'Essay', finishLine: '3 pages', contextNote: 'outline it' })
    expect(result.workDraft).toContain('### Immediate 20-Minute Slice')
  })

  it('carries a stated deadline into the plan for any kind of mission', () => {
    expect(extractDeadline('Cause it’s due in 3 days — Cause i don’t want to fail — displaced X to parked')).toBe('due in 3 days')
    expect(extractDeadline('it matters most right now')).toBeNull()
    const result = buildDeterministicAssistance({
      title: 'Plan the shoot',
      finishLine: 'Shot list done',
      contextNote: 'two locations',
      deadline: { text: 'due Friday', saidAt: '2026-10-19T12:00:00Z' },
    })
    expect(result.workDraft).toContain('**Deadline you mentioned:** due Friday')
  })

  it('reports which declared units were checked, even with no budget', () => {
    const result = buildDeterministicAssistance({ title: 'Deck', finishLine: '12 slides ready', contextNote: 'start' })
    expect(result.constraintCheck).toEqual({ checked: ['slides'], conflicts: [] })
  })
})

describe('review findings on PR #122', () => {
  it('does not take a deadline from the displaced mission title', () => {
    expect(extractDeadline('finish it — it matters most — displaced Essay due Friday to parked')).toBeNull()
  })

  it('does not count quantities echoed from the finish line as budgets', () => {
    const result = buildDeterministicAssistance({ title: 'Essay', finishLine: 'Write ~10 pages', contextNote: 'outline it' })
    expect(result.constraintCheck.conflicts).toEqual([])
    expect(result.workDraft).toContain('Core Analysis / Evidence Sections (~')
  })
})

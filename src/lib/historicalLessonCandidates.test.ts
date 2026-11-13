/** @vitest-environment node */
// Tests are against the REAL recovered source corpus. No fictional accounts,
// simulated events, synthetic records or production writes.
import { describe, expect, it } from 'vitest'
import { BOOMERANG_CASES } from './boomerangCasebook'
import { INCIDENT_CANDIDATES } from './incidentCandidates'
import { HISTORICAL_LESSON_CANDIDATES, findReviewableLessonCandidate, reviewCandidateSources } from './historicalLessonCandidates'

describe('historical boomerangs visible in the existing owner lesson gate', () => {
  it('lists every actual casebook entry once without duplicating existing incident IC-001', () => {
    const allIds = [...INCIDENT_CANDIDATES.map(x => x.casebookId), ...HISTORICAL_LESSON_CANDIDATES.map(x => x.casebookId)]
    expect(allIds.sort()).toEqual(BOOMERANG_CASES.map(x => x.id).sort())
    expect(new Set(allIds).size).toBe(BOOMERANG_CASES.length)
    expect(HISTORICAL_LESSON_CANDIDATES).toHaveLength(33)
    expect(HISTORICAL_LESSON_CANDIDATES.find(x => x.id === 'BR-034')).toBeUndefined()
  })

  it('preserves documentary status and original source metadata, never invents attempts or verified transfer', () => {
    for (const candidate of HISTORICAL_LESSON_CANDIDATES) {
      const original = BOOMERANG_CASES.find(record => record.id === candidate.id)
      expect(candidate.record).toBe(original)
      expect(candidate.proposedRule).toBe(original?.practicalConsequence)
      expect(original?.inheritance).toBe('not-demonstrated')
      expect(candidate.whenToApply).toContain(original!.sharedStructure)
      expect(candidate.exceptions).toContain(original!.evidenceRequired)
      expect(candidate.proposedRule.length).toBeLessThanOrEqual(1000)
      expect(candidate.whenToApply.length).toBeLessThanOrEqual(500)
      expect(candidate.exceptions.length).toBeLessThanOrEqual(800)
      const refs = reviewCandidateSources(candidate)
      expect(refs).toHaveLength(original!.sources.length)
      expect(refs.every(ref => ref.id.startsWith('casebook:' + candidate.id + ':source:'))).toBe(true)
      expect(refs.every(ref => Boolean(ref.label) && Boolean(ref.status))).toBe(true)
      for (let index = 0; index < refs.length; index++) {
        expect(refs[index].url).toBe(original!.sources[index].url)
        if (original!.sources[index].access === 'restricted') expect(refs[index].url).toBeUndefined()
      }
      expect(findReviewableLessonCandidate(candidate.id)).toBe(candidate)
    }
  })

  it('keeps IC-001 unchanged and refuses unidentified candidates', () => {
    expect(findReviewableLessonCandidate('IC-001')).toBe(INCIDENT_CANDIDATES[0])
    expect(findReviewableLessonCandidate('BR-034')).toBeNull()
    expect(findReviewableLessonCandidate('BR-999')).toBeNull()
    expect(findReviewableLessonCandidate({ id: 'BR-001' })).toBeNull()
  })
})

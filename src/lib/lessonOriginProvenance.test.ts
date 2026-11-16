/** @vitest-environment node */
// Algorithm/source-contract tests only. Inputs are checked-in casebook content
// and source-code fingerprints. No users, mission rows, confirmations, database
// doubles or model results are created. Corpus IDs below are document IDs used
// to exercise a generic selector, not claims that these documents are missions.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BOOMERANG_CASES } from './boomerangCasebook'
import { HISTORICAL_LESSON_CANDIDATES, reviewCandidateSources } from './historicalLessonCandidates'
import { hasProjectReviewOrigin } from './lessonProvenance'
import { relatedProjectSignal } from './projectReview'
import { selectInvestigationProjects } from './structuralTransfer'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const writer = source('../app/api/delta-lessons/route.ts')
// An actual source fingerprint exercises the writer's SHA256 key grammar.
// This is a contract token, never a purported saved confirmation.
const reviewKey = `lesson:confirm:${createHash('sha256').update(writer).digest('hex')}`

describe('lesson provenance from authentic source contracts', () => {
  it('keeps missing and unfamiliar provenance unknown', () => {
    expect(hasProjectReviewOrigin(undefined, undefined)).toBe(false)
    expect(hasProjectReviewOrigin(undefined, null)).toBe(false)
    expect(hasProjectReviewOrigin(BOOMERANG_CASES[0].recordStatus, reviewKey)).toBe(false)
    expect(hasProjectReviewOrigin(null, reviewKey)).toBe(false)
  })

  it('recognizes legacy Project Review keys and explicit review provenance only with that contract', () => {
    expect(writer).toContain('const key = `lesson:confirm:${digest}`')
    expect(hasProjectReviewOrigin(undefined, reviewKey)).toBe(true)
    expect(hasProjectReviewOrigin('project_review', reviewKey)).toBe(true)
    expect(hasProjectReviewOrigin('project_review', undefined)).toBe(false)
    expect(hasProjectReviewOrigin(undefined, reviewKey.slice(0, -1))).toBe(false)
  })

  it('does not promote historical, incident or received rules to review origins', () => {
    for (const origin of ['casebook', 'incident', 'relay']) {
      expect(hasProjectReviewOrigin(origin, reviewKey)).toBe(false)
      expect(hasProjectReviewOrigin(origin, undefined)).toBe(false)
    }
  })

  it('preserves four relevant corpus selections instead of prioritizing a documentary anchor', () => {
    const anchor = HISTORICAL_LESSON_CANDIDATES.find(item => item.id === 'BR-002')!
    const target = BOOMERANG_CASES.find(item => item.id === 'BR-001')!
    const text = JSON.stringify(target)
    const relevant = BOOMERANG_CASES.filter(item => item.id !== anchor.id && item.id !== target.id)
      .map(item => ({ mission: { id: item.id, updated_at: item.era },
        ...relatedProjectSignal(text, { id: item.id, title: item.title, why: item.sharedStructure, finish_line: item.practicalConsequence }) }))
      .filter(item => item.score >= 2).slice(0, 4)
    expect(relevant).toHaveLength(4)
    const candidates = [{ mission: { id: anchor.id, updated_at: anchor.record.era },
      ...relatedProjectSignal('', { id: anchor.id, title: anchor.title }) }, ...relevant]
    const origins = hasProjectReviewOrigin('casebook', undefined) ? [anchor.id] : []
    const selected = selectInvestigationProjects(candidates, origins, [])
    expect(selected.map(item => item.mission.id).sort()).toEqual(relevant.map(item => item.mission.id).sort())
    expect(selected.some(item => item.reason.includes('Confirmed lesson origin'))).toBe(false)
    // A documentary anchor may still be selected by relevance, without a false origin label.
    const byRelevance = selectInvestigationProjects(relevant, [], [])
    expect(byRelevance).toHaveLength(4)
    // Keep explicit origin and correction priority. IDs here identify real
    // corpus documents; this tests ordering, not saved origin/correction events.
    const priority = selectInvestigationProjects(candidates, [relevant[0].mission.id], [relevant[1].mission.id])
    expect(priority.slice(0, 2).map(item => item.reason)).toEqual([
      'Confirmed lesson origin; structural relevance must be investigated.',
      'Prior correction origin; structural relevance must be investigated.',
    ])
  })

  it('keeps the original source labels and restrictions attached to all historical proposals', () => {
    for (const candidate of HISTORICAL_LESSON_CANDIDATES) {
      const refs = reviewCandidateSources(candidate)
      expect(refs.map(ref => ref.label)).toEqual(candidate.record.sources.map(ref => ref.label))
      expect(refs.map(ref => ref.url)).toEqual(candidate.record.sources.map(ref => ref.url))
      expect(candidate.proposedRule).toBe(candidate.record.practicalConsequence)
      expect(candidate.whenToApply).toContain(candidate.record.sharedStructure)
      expect(candidate.exceptions).toContain(candidate.record.evidenceRequired)
      expect(candidate.record.inheritance).toBe('not-demonstrated')
      for (const [index, ref] of candidate.record.sources.entries()) {
        if (ref.access === 'restricted') expect(refs[index].status).toContain('Restricted origin label only')
      }
    }
  })

  it('classifies on reload for existing rows and never falls back to the ledger mission downstream', () => {
    const loader = source('./projectLessonsServer.ts')
    expect(loader).toContain('id,mission_id,detail,created_at,idempotency_key')
    expect(loader).toContain('hasProjectReviewOrigin(saved.origin, row.idempotency_key)')
    expect(loader).not.toContain('origin === undefined ? row.mission_id')
    const review = source('./projectReviewServer.ts')
    expect(review).toContain('typeof lesson.originMissionId')
    expect(review).not.toMatch(/lessonOrigins[^;]*\[lesson\.missionId\]/)
    expect(review).toContain('appliesOnlyToMissionId: ledgerMissionId')
    expect(review).toContain("source.kind === 'lesson'")
    expect(source('./learnedContext.ts')).toContain('sourceRefs: lesson.sourceRefs')
    expect(source('./learnedContext.ts')).toContain('exceptions: lesson.exceptions')
    expect(source('./structuralTransfer.ts')).toContain('lesson.lesson.originMissionId !== prior.missionId')
  })
})

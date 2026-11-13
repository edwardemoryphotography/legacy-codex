import { BOOMERANG_CASES, type BoomerangCase } from './boomerangCasebook'
import { INCIDENT_CANDIDATES, type IncidentCandidate } from './incidentCandidates'

// Derive proposed lessons from the ACTUAL authored casebook. The projection
// adds no source incidents, attempted fixes, outcomes or historical claims.
// It is not a human confirmation, and it cannot enter model context by itself.
export interface HistoricalLessonCandidate {
  kind: 'historical-casebook'
  id: string
  casebookId: string
  title: string
  record: BoomerangCase
  proposedRule: string
  whenToApply: string
  exceptions: string
}

const covered = new Set(INCIDENT_CANDIDATES.map(candidate => candidate.casebookId))
export const HISTORICAL_LESSON_CANDIDATES: readonly HistoricalLessonCandidate[] =
  BOOMERANG_CASES.filter(record => !covered.has(record.id)).map(record => ({
    kind: 'historical-casebook' as const,
    id: record.id,
    casebookId: record.id,
    title: record.title,
    record,
    proposedRule: record.practicalConsequence,
    // These two fields are proposed review language based on the actual
    // record. They are NOT purported quotes or observed historical facts.
    whenToApply: `When a current, independently examined problem shows this structure: ${record.sharedStructure}.`,
    exceptions: `A historical reconstruction or a similar phrase is not proof of a shared cause. Check disconfirming evidence before applying. Required verification: ${record.evidenceRequired}.`,
  }))

export type ReviewableLessonCandidate = IncidentCandidate | HistoricalLessonCandidate

export function findReviewableLessonCandidate(id: unknown): ReviewableLessonCandidate | null {
  if (typeof id !== 'string') return null
  return INCIDENT_CANDIDATES.find(candidate => candidate.id === id)
    ?? HISTORICAL_LESSON_CANDIDATES.find(candidate => candidate.id === id)
    ?? null
}

export function reviewCandidateSources(candidate: ReviewableLessonCandidate):
  Array<{ id: string; label: string; status: string; url?: string }> {
  if (!('record' in candidate)) return candidate.sources.map(source => ({
    id: `incident:${candidate.id}:${source.id}`, label: source.label, status: source.status, url: source.url,
  }))
  return candidate.record.sources.map((source, index) => ({
    id: `casebook:${candidate.id}:source:${index}`,
    label: source.label,
    status: source.access === 'restricted'
      ? 'Restricted origin label only; this public record does not reproduce or independently verify the underlying private content.'
      : 'Linked documentary source; a working URL alone does not verify that it supports this specific interpretation.',
    ...(source.url ? { url: source.url } : {}),
  }))
}

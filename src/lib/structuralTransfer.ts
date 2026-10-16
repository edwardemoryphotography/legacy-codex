import type { ConfirmedLesson, ProjectSource, ReviewProposal } from './projectReview'

// Candidates are authenticated rows, never generated projects. Provenance can
// earn a deeper read without a keyword match; it cannot establish an analogy.
export function selectInvestigationProjects<T extends { id: string; updated_at: string }>(
  candidates: { mission: T; score: number; reason: string }[], lessonOrigins: string[], correctionOrigins: string[],
): { mission: T; score: number; reason: string }[] {
  const selected: typeof candidates = []
  for (const [ids, reason] of [
    [lessonOrigins, 'Confirmed lesson origin; structural relevance must be investigated.'],
    [correctionOrigins, 'Prior correction origin; structural relevance must be investigated.'],
  ] as const) {
    for (const id of ids) {
      const candidate = candidates.find(item => item.mission.id === id)
      if (candidate && !selected.some(item => item.mission.id === id) && selected.length < 4) selected.push({ ...candidate, reason })
    }
  }
  for (const candidate of [...candidates].filter(item => item.score >= 2).sort((a, b) => b.score - a.score || b.mission.updated_at.localeCompare(a.mission.updated_at))) {
    if (selected.length < 4 && !selected.some(item => item.mission.id === candidate.mission.id)) selected.push(candidate)
  }
  return selected
}

export interface StructuralBridge {
  priorSourceId: string
  currentSourceId: string
  priorQuote: string
  currentQuote: string
  sharedStructure: string
  reasoningBridge: string
  application: string
  proofRequired: string
  lessonSourceId: string | null
}

// Exact excerpts prove that the cited material was supplied, not that the
// model's interpretation is right. Project provenance is attached by the server.
export function parseStructuralBridge(value: unknown, sources: ProjectSource[], missionId: string): StructuralBridge | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  for (const key of ['priorSourceId', 'currentSourceId', 'priorQuote', 'currentQuote', 'sharedStructure', 'reasoningBridge', 'application', 'proofRequired']) {
    if (typeof row[key] !== 'string' || !(row[key] as string).trim() || (row[key] as string).length > 600) return null
  }
  const prior = sources.find(source => source.id === row.priorSourceId)
  const current = sources.find(source => source.id === row.currentSourceId)
  if (!prior?.missionId || prior.missionId === missionId || current?.missionId !== missionId ||
      ['lesson', 'model_draft'].includes(prior.kind) || ['lesson', 'model_draft'].includes(current.kind) ||
      !prior.text.includes(row.priorQuote as string) || !current.text.includes(row.currentQuote as string)) return null
  if (row.lessonSourceId !== null) {
    const lesson = sources.find(source => source.kind === 'lesson' && source.id === row.lessonSourceId)
    // Mission-scoped rules cannot authorize transfer to a different project.
    if (!lesson?.lesson || lesson.lesson.scope !== 'account' || lesson.missionId !== prior.missionId) return null
  }
  return { priorSourceId: prior.id, currentSourceId: current.id, priorQuote: row.priorQuote as string,
    currentQuote: row.currentQuote as string, sharedStructure: row.sharedStructure as string,
    reasoningBridge: row.reasoningBridge as string, application: row.application as string,
    proofRequired: row.proofRequired as string, lessonSourceId: row.lessonSourceId as string | null }
}

const DECISION_FIELDS = ['decision', 'operation', 'finishWhen', 'clarification', 'resumeActionId', 'workDraft'] as const
export function decisionSnapshot(review: ReviewProposal | null) {
  if (!review) return null
  return { decision: review.decision, operation: review.operation, finishWhen: review.finishWhen,
    clarification: review.clarification, resumeActionId: review.resumeActionId, workDraft: review.workDraft ?? null }
}

export function measureTransfer(input: {
  baseline: ReviewProposal | null; after: ReviewProposal | null; sources: ProjectSource[];
  lessons: ConfirmedLesson[]; missionId: string; requestContextAdded: boolean; reviewedAt: string;
  interventionEvidence?: { since: string; eventCount: number; objectiveUpdated: boolean } | null;
}) {
  const { baseline, after, sources, lessons, missionId, requestContextAdded, reviewedAt } = input
  const suppliedLessons = lessons.filter(lesson => sources.some(source => source.id === `lesson:${lesson.id}`))
  const before = decisionSnapshot(baseline)
  const next = decisionSnapshot(after)
  const changedFields = before && next ? DECISION_FIELDS.filter(key => before[key] !== next[key]) : []
  const bridge = after?.structuralBridge
  const applied = suppliedLessons.find(lesson => bridge?.lessonSourceId === `lesson:${lesson.id}` && lesson.scope === 'account' && lesson.missionId !== missionId && Date.parse(lesson.confirmedAt) < Date.parse(reviewedAt))
  // This count is queried independently of model-context limits. Never infer
  // absence of intervention from a clipped or paginated source packet.
  const intervention = input.interventionEvidence
  const completeInterventionRead = !suppliedLessons.length || Boolean(intervention &&
    Number.isFinite(Date.parse(intervention.since)) && Number.isInteger(intervention.eventCount) && intervention.eventCount >= 0 &&
    Date.parse(intervention.since) <= Math.min(...suppliedLessons.map(lesson => Date.parse(lesson.confirmedAt))))
  const human_intervention_required = requestContextAdded || after?.decision === 'clarify' || !completeInterventionRead ||
    Boolean(intervention && (intervention.eventCount > 0 || intervention.objectiveUpdated))
  const outcome = !suppliedLessons.length ? 'no_confirmed_lesson' : !before ? 'comparison_unavailable' :
    !applied ? 'no_grounded_cross_project_application' : human_intervention_required ? 'human_intervention' :
      !changedFields.length ? 'no_observed_change' : 'changed_candidate'
  return {
    version: 1 as const, method: 'sequential_lesson_withholding' as const,
    inheritance: 'Unknown' as const,
    outcome, human_intervention_required,
    interventionBasis: { requestContextAdded, clarificationRequested: after?.decision === 'clarify', completeInterventionRead, since: intervention?.since ?? null, savedEventCount: intervention?.eventCount ?? null, objectiveUpdated: intervention?.objectiveUpdated ?? null },
    interventionScope: 'This request and saved target context at or after supplied lesson confirmation. False is not proof of autonomous transfer.',
    withheldSourceIds: sources.filter(source => source.kind === 'lesson').map(source => source.id),
    appliedLessonSourceId: applied ? `lesson:${applied.id}` : null,
    baseline, after: next, changedFields,
    limitations: ['Sequential critique and model sampling confound attribution; changed text is not causal proof.',
      'Underlying artifacts may teach the baseline the same rule even when the confirmed lesson is withheld.',
      'No independent task outcome or actual user workflow has been verified by this comparison.'],
  }
}

export type TransferObservation = ReturnType<typeof measureTransfer>

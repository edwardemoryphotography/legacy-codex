import type { DeltaCandidate, DeltaCorrection, EvidenceRecord, Mission, StrategicDelta } from '@/types'
import type { ProjectReview } from './projectReview'
import { predictStrategicDelta } from './strategicDelta'

export function reviewCandidate(projectReview: ProjectReview | null): DeltaCandidate | null {
  if (!projectReview?.operation) return null
  return {
    id: `project-operation:${projectReview.missionId}:${encodeURIComponent(projectReview.operation)}`,
    targetId: `project:${projectReview.missionId}`,
    kind: 'model_suggested', missionId: projectReview.missionId,
    move: projectReview.operation, projectFinishLine: projectReview.finishLine, rank: 0,
  }
}

export function selectReviewedDelta(missions: Mission[], evidence: EvidenceRecord[], corrections: DeltaCorrection[], now: string,
  suggestedOperations: DeltaCandidate[], projectReview: ProjectReview | null): StrategicDelta {
  const predicted = predictStrategicDelta(missions, evidence, corrections, now, suggestedOperations)
  const target = missions.find(mission => mission.id === predicted.missionId)
  // A deciding question supersedes filler operations for this project,
  // while supplied steps and conflict/blocker/capacity gates keep priority.
  if (projectReview?.decision !== 'clarify' || predicted.missionId !== projectReview.missionId ||
      predicted.provenance === 'supplied' || predicted.situation === 'evidence_conflict' ||
      !target || target.blocker || target.capacityMismatch) return predicted
  return { ...predicted, provenance: 'insufficient_context' as const, candidateId: `project:${target.id}`,
    move: projectReview.clarification!, because: projectReview.why,
    blockingGap: 'One fact would change the best next move.', wouldChangeIf: projectReview.clarification! }
}

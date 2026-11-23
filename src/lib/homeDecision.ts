import type { DeltaCorrection, Mission, StrategicDelta } from '@/types'
import type { HomeContinueView } from './homeContinue'
import type { ProjectReview } from './projectReview'
import { operationsEquivalent } from './operationEquivalence'
import { reviewCandidate } from './reviewedDelta'
import type { SavedActionSnapshot } from './nextAction'

/** A recommendation can change while the commitment and its return note retain their identity. */
export function homeDecision(view: HomeContinueView, mission: Mission, saved: SavedActionSnapshot | null,
  delta: StrategicDelta, review: ProjectReview | null, corrections: DeltaCorrection[]) {
  const reviewed = review && (delta.provenance === 'model' && delta.candidateId === reviewCandidate(review)?.id ||
    review.decision === 'clarify' && delta.candidateId === `project:${mission.id}` && delta.move === review.clarification) ? review : null
  const constrained = ['primary_blocked', 'primary_capacity_mismatch', 'evidence_conflict'].includes(delta.situation)
  const sameAction = saved && saved.missionId === delta.missionId && saved.title.trim() === delta.move.trim()
  const resume = reviewed?.decision === 'resume' && sameAction && reviewed.resumeActionId === saved.id
  const rejected = [...corrections].reverse().find(c => c.missionId === mission.id && view.stepTitle &&
    (c.correctedMove === view.stepTitle || operationsEquivalent(c.correctedMove, view.stepTitle)))
  const commitmentLeads = saved && !rejected && !constrained && (resume || (!reviewed && (delta.provenance !== 'supplied' || sameAction)))
  const acceptedLeads = !saved && view.status === 'accepted' && !rejected && !constrained && !reviewed && delta.provenance !== 'supplied'
  const reasons = [...view.reasons]
  const specific = reviewed?.unknowns[0] || delta.wouldChangeIf
  if (rejected) reasons.push({ label: 'Your reason for setting this move aside', text: rejected.reason })
  if (specific) reasons.push({ label: 'What would change this move', text: specific })
  if (reviewed) {
    if (reviewed.workDraft) reasons.push({ label: 'Draft to work from', text: reviewed.workDraft })
    if (reviewed.finishWhen) reasons.push({ label: 'Finish this move when', text: reviewed.finishWhen })
    for (const alt of reviewed.alternatives) reasons.push({ label: alt.operation, text: alt.whyNot })
    for (const src of reviewed.sources.filter(s => reviewed.sourceIds.includes(s.id))) {
      reasons.push({ label: src.label, text: src.status })
    }
    if (reviewed.structuralBridge) {
      const bridge = reviewed.structuralBridge
      reasons.push({ label: 'Possible connection', text: [reviewed.sources.find(s => s.id === bridge.priorSourceId)?.label, bridge.priorQuote, reviewed.sources.find(s => s.id === bridge.currentSourceId)?.label, bridge.currentQuote, bridge.sharedStructure, bridge.reasoningBridge, bridge.application, bridge.proofRequired].join('\n') })
    }
  }
  if (commitmentLeads || acceptedLeads) {
    const why = reviewed?.why ?? (acceptedLeads ? 'You accepted this suggestion. The recorded constraints give no reason to set it aside.' :
      'You already chose this step. The available mission records give no higher-priority reason to interrupt it.')
    if (!reviewed && delta.move !== view.stepTitle) reasons.push({ label: 'Also considered', text: delta.move })
    return { view: { ...view, reasons, cta: saved?.status === 'TODO' ? 'Open this saved step' : view.cta }, why, followsSaved: Boolean(saved), correction: { missionId: mission.id, move: view.stepTitle!, candidateId: resume ? delta.candidateId : null }, reviewed }
  }
  if (saved) reasons.unshift({ label: 'Your existing commitment', text: saved.title })
  else if (view.status === 'accepted' && view.stepTitle) reasons.unshift({ label: 'Previously accepted', text: view.stepTitle })
  const question = delta.provenance === 'insufficient_context'
  const capacityGap = question && delta.situation === 'primary_capacity_mismatch'
  const title = capacityGap ? 'What smaller step fits your available capacity?' : delta.move
  const why = reviewed?.why ?? (capacityGap ? 'You reported that the Primary mission exceeds your capacity.' : delta.because)
  return {
    view: { ...view, reasons: reasons.filter(reason => reason.label !== 'Where this step came from'), status: question ? 'clarify' as const : 'suggested' as const,
      stepTitle: title, stepLabel: delta.missionId && delta.missionId !== mission.id ? `Next move on ${delta.missionTitle}` : question ? 'One thing to clarify' : reviewed ? 'Project review · proposed move' : 'Suggested next move',
      cta: question ? 'Clarify in Mission' : 'Work on this in Mission' },
    why, followsSaved: false, correction: !question && delta.missionId ? { missionId: delta.missionId, move: delta.move, candidateId: delta.candidateId } : null, reviewed,
  }
}
